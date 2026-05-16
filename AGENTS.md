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
