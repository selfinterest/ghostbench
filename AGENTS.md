# AGENTS.md

## Project

Ghostbench is a local-first TypeScript CLI for evaluating how well coding agents understand a repository before proposing changes.

It is not a chatbot. It is an eval harness for repo-aware coding agents.

The MVP should run entirely offline using fixture responses. Do not call OpenAI, Anthropic, GitHub, or any other external API in the initial implementation.

## Tech Stack

- TypeScript
- Node.js
- pnpm
- Plain modules preferred
- No web framework
- No database
- No external model calls for the MVP

## Core Commands

Expected commands:

```bash
pnpm install
pnpm typecheck
pnpm ghostbench run cases/bagshui-layout.json
pnpm ghostbench compare cases/bagshui-layout.json
pnpm ghostbench init-case
```

If scripts do not exist yet, create them.

## Desired File Structure

```text
ghostbench/
  package.json
  tsconfig.json
  README.md
  AGENTS.md
  CONTEXT.md
  src/
    cli.ts
    types.ts
    loadCase.ts
    loadRepoContext.ts
    runCase.ts
    judge.ts
    report.ts
  cases/
    bagshui-layout.json
    nightcrawler-template-update.json
  fixtures/
    bagshui-good-response.md
    bagshui-bad-response.md
    nightcrawler-good-response.md
    nightcrawler-bad-response.md
  reports/
    .gitkeep
```

## Implementation Standards

Keep the code small, boring, and legible.

Prefer explicit TypeScript types over clever abstractions.

Avoid unnecessary dependencies. A tiny CLI parser is fine. Do not add Commander unless there is a clear benefit.

Every module should have one job:

- `cli.ts`: parse commands and call the right workflow
- `types.ts`: shared TypeScript interfaces
- `loadCase.ts`: read and validate JSON eval cases
- `loadRepoContext.ts`: scan a target repo safely and return bounded context
- `runCase.ts`: orchestrate case loading, repo scanning, fixture loading, judging, and reporting
- `judge.ts`: deterministic heuristic judging for MVP
- `report.ts`: console and markdown report generation

## Repo Scanner Requirements

`loadRepoContext.ts` should:

- Accept a `repoPath`
- Recursively list files
- Ignore:
  - `node_modules`
  - `.git`
  - `dist`
  - `build`
  - `coverage`
  - `.next`
  - `vendor`
- Include only likely source/config/documentation files:
  - `.ts`
  - `.tsx`
  - `.js`
  - `.jsx`
  - `.json`
  - `.md`
  - `.css`
  - `.html`
  - `.lua`
  - `.xml`
- Bound scanning:
  - Max 200 files
  - Max 20 KB per file
- If `repoPath` does not exist, continue with a warning instead of failing the whole run.

## Judge Requirements

For the MVP, implement a deterministic heuristic judge.

Do not use an LLM yet.

The judge should:

- Score each rubric item from 0 to 10
- Apply rubric weights
- Look for evidence in the agent response and repo context
- Penalize invented files not found in repo context
- Penalize unsupported confident claims
- Reward concrete implementation plans grounded in files, functions, or observed repo structure
- Produce:
  - raw score
  - max score
  - weighted score
  - verdict: `strong`, `acceptable`, or `weak`
  - evidence strings
  - concern strings

Make the judge intentionally replaceable. It should be obvious how to later swap in an LLM judge.

## Settled MVP Decisions

These choices came out of the domain grilling session. Treat them as implementation guidance unless a later ADR supersedes them.

### Case Format

- Eval cases are JSON for the MVP, but `CONTEXT.md` keeps the domain language format-agnostic.
- Case JSON should include `responses`, not `fixtures`.
- Each response entry should include a human-readable `name` and a `fixturePath`.
- All paths inside an eval case, including `repoPath` and `fixturePath`, should resolve relative to the case file.
- `responses` are embedded in the case file as an MVP convenience. Conceptually, a run evaluates selected agent responses against an eval case.
- Every MVP case must include:
  - a stable human-readable slug `id`
  - a user-style `task`
  - at least one response
  - at least one rubric item
- `expectedFiles` are optional and advisory. They may name files, directories, or repository areas, including documentation.
- `expectedFiles` should appear in reports, but should not be treated as hidden gold labels.
- Fixture responses are markdown text files for the MVP.
- Missing, unreadable, or empty fixture responses are validation errors.
- Missing target repositories are warnings, not validation errors.
- Malformed case JSON and missing rubric items are validation errors.
- Rubric item weights are positive relative weights. They do not need to sum to 1 or 100.
- Rubric item scores are constrained to 0 through 10.
- Rubric item descriptions should be evaluative, not imperative.

### Run Behavior

- `run` and `compare` use the same execution path.
- `compare` changes console emphasis; it does not create a different domain artifact.
- A run can evaluate one or more agent responses.
- Ranking exists only when multiple agent responses are evaluated.
- `compare` with one response should still run and emit a warning that ranking is not meaningful.
- CLI runs should exit nonzero for invalid inputs or runtime failures, not because all responses are weak.
- `init-case` should create a richer valid template at `cases/new-case.json` and must not overwrite an existing file.

### Repo Source Boundary

- Ghostbench must retain the ability to scan existing local repositories supplied by `repoPath`.
- A user-supplied `repoPath` may point anywhere the user can read, including sibling directories outside the Ghostbench checkout.
- GitHub repositories may be supplied with `repoUrl` and optional `repoRef` in the case file, or with `--repo-url` and optional `--repo-ref` at the CLI.
- GitHub repo support should use local `git` clone/fetch behavior, not GitHub API calls.
- Remote repo support should resolve to a local checkout before scanning, then reuse `loadRepoContext.ts`.
- Do not copy, clone, cache, or vendor target repositories inside the Ghostbench project directory.
- Acquired repository material must live outside the Ghostbench checkout, such as under a temp workspace or user cache directory.
- Keep Ghostbench source, eval cases, fixtures, and reports separate from target repository contents.

### Judging Heuristics

- Use both rubric-specific signals and general Ghostbench heuristics.
- Extract meaningful keywords from the task and rubric descriptions, dropping common stopwords.
- Treat expected-file matches as stronger evidence than keyword overlap.
- Parse likely file paths from agent responses conservatively.
- Parse simple backticked symbols and function-like names conservatively.
- Search extracted symbols against file paths and included file contents in the repo context.
- Phrase absent path or symbol concerns as "not found in available repo context", not as absolute nonexistence.
- Penalize unsupported confident claims more than cautious guesses.
- Reward specific inspection plans; do not reward generic "I would inspect the code" language much.
- Reward edge-case awareness as a weak general signal, with task/rubric-specific edge cases carrying more weight.
- Penalize generic plans that could apply to any repository.
- Penalize overbroad rewrite language unless the task asks for that scope.
- Keep scores bounded. Concerns should not drive numeric scores below 0.
- Do not globally cap verdicts because of one invented file; repeated or central invented references should strongly hurt the verdict.
- Verdicts use fixed global thresholds for the MVP.
- Rank by weighted score with deterministic tie-breakers, such as verdict and stable response name.

### Reporting

- Generate one markdown report and one console summary for every successful run.
- Markdown reports are the only durable run record for the MVP.
- Keep generated reports under `reports/{caseId}-{timestamp}.md`.
- Commit `reports/.gitkeep`, but gitignore generated `reports/*.md`.
- Reports should include warnings before score tables.
- Reports should include task text, repo path, repo context summary, expected files when present, response names, fixture paths, per-rubric-item scores, evidence, concerns, warnings, and ranking when multiple responses were evaluated.
- Reports should order response result sections by ranking, not input order.
- Reports should show full evidence and concern strings.
- Reports should not include full agent response text by default.
- Console summaries should be compact: ranking when available, scores, verdicts, warnings, and the highest-signal concern.
- Console summaries should avoid "winner"; use "ranking" or "top response".

## Report Requirements

Generate both:

1. Console summary
2. Markdown report under:

```text
reports/{caseId}-{timestamp}.md
```

The report should include:

- Case title
- Task
- Repo path
- Repo context summary
- Agent response names
- Score table
- Evidence
- Concerns
- Final ranking

## CLI Commands

Implement:

```bash
pnpm ghostbench run <casePath>
```

Runs the case against fixture responses and writes a report.

```bash
pnpm ghostbench compare <casePath>
```

Same execution path as `run`, but the console output should emphasize ranking and comparison.

```bash
pnpm ghostbench init-case
```

Writes a starter JSON case to `cases/new-case.json` if it does not already exist.

## Sample Cases

Create two sample cases:

1. `bagshui-layout.json`
   - Task: make the Bagshui addon window as compact as possible by placing categories horizontally when useful.
   - Good response should identify layout behavior, propose a bounded change, mention overflow/resizing edge cases, and avoid unrelated rewrites.
   - Bad response should invent files, suggest a vague rewrite, and ignore edge cases.

2. `nightcrawler-template-update.json`
   - Task: reason about an MCP/Nightingale/Nightcrawler-style repo where cached GCS extracts are compared against a nursing model repo and used to generate update PRs.
   - Good response should emphasize bounded repo understanding, artifact comparison, stable identifiers, cache behavior, and reviewable PR generation.
   - Bad response should overfit to generic RAG, suggest a vector database as the primary store without justification, or skip determinism/versioning concerns.

## README Requirements

The README should explain:

- What Ghostbench is
- Why repo-aware coding-agent evals matter
- How to install
- How to run sample cases
- How to add a new case
- How reports work
- Future roadmap:
  - OpenAI/Anthropic model provider adapters
  - LLM-as-judge
  - MCP server exposing:
    - `run_eval_case`
    - `compare_model_runs`
    - `inspect_failure`
  - GitHub PR comment mode
  - “grill mode” that asks follow-up questions before scoring

## Done Means

Before stopping:

- Run `pnpm install`
- Run `pnpm typecheck`
- Run `pnpm ghostbench run cases/bagshui-layout.json`
- Fix any errors
- Show final file tree
- Show exact commands to run
- Summarize the architecture concisely

## Do Not Do

- Do not build a web UI
- Do not add a database
- Do not call external APIs
- Do not require a real Bagshui or Nightcrawler repo to exist
- Do not over-engineer provider abstractions
- Do not bury the project in dependencies
