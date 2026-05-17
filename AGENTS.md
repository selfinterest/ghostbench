# AGENTS.md

## Project

Ghostbench is a local-first TypeScript CLI for assessing vibe-coded application repositories.

Its primary workflow answers one question for an app owner: is this repository ready to ship, hand off, or continue developing with agents?

The default workflow is deterministic and offline. Ghostbench scans a repository, detects framework signals, inventories package scripts, runs only the execution checks allowed by the selected policy, and writes a readiness report with evidence, concerns, blocking concerns, dimension scores, and remediation guidance.

The older repo-understanding workflow for judging saved agent responses is still supported through `run` and `compare`, but new product work should target `assess`.

OpenAI may be called only when the user explicitly supplies `--provider openai --model <model>`.

## Tech Stack

- TypeScript
- Node.js
- pnpm
- Plain modules preferred
- No web framework
- No database
- No external model calls in default workflows
- OpenAI SDK is allowed only for explicit provider-assisted assessment or legacy provider response generation

## Core Commands

Expected commands:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm ghostbench assess ./fixture-repos/coherent-vite-app --brief "Inventory Desk is an operations dashboard for tracking low-stock items, supplier status, and reorder decisions."
pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check
pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check --output json
pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check --baseline <assessment.json>
pnpm ghostbench doctor
pnpm ghostbench run cases/bagshui-layout.json
pnpm ghostbench compare cases/bagshui-layout.json
pnpm ghostbench init-case
```

If scripts do not exist yet, create them.

## Current File Structure

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
    loadRepoContext.ts
    assess.ts
    assessRuntime.ts
    assessScoring.ts
    doctor.ts
    regression.ts
    resolveRepoSource.ts
    loadCase.ts
    runCase.ts
    judge.ts
    report.ts
    providers/
  cases/
    ghostbench-readiness.json
    inventory-desk-readiness.json
    bagshui-layout.json
    nightcrawler-template-update.json
  fixture-repos/
    coherent-vite-app/
    messy-vibe-app/
  fixtures/
  tests/
  docs/adr/
  reports/
    .gitkeep
```

Generated `reports/*.md` and `reports/*.json` are gitignored. Keep `reports/.gitkeep`.

## Implementation Standards

Keep the code small, boring, and legible.

Prefer explicit TypeScript types over clever abstractions.

Avoid unnecessary dependencies. The CLI uses a small hand-rolled parser; do not add Commander unless there is a clear benefit.

Every module should have one job:

- `cli.ts`: parse commands and call the right workflow
- `types.ts`: shared TypeScript interfaces
- `loadRepoContext.ts`: scan a target repo safely and return bounded context
- `assess.ts`: orchestrate readiness assessment
- `assessRuntime.ts`: detect framework/script signals and run allowed execution checks
- `assessScoring.ts`: deterministic readiness scoring and remediation guidance
- `doctor.ts`: self-check Ghostbench project health
- `regression.ts`: compare readiness assessments against JSON baselines
- `resolveRepoSource.ts`: resolve local and GitHub repo sources to a local checkout
- `loadCase.ts`: read and validate legacy agent-response eval cases
- `runCase.ts`: orchestrate the legacy agent-response workflow
- `judge.ts`: deterministic heuristic judging for legacy agent responses
- `report.ts`: console, markdown, JSON, and regression report rendering
- `providers/`: explicit OpenAI provider integration

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
- Include likely source/config/documentation files:
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
  - `.yaml`
  - `.yml`
  - common extensionless docs such as `README`, `LICENSE`, and `CHANGELOG`
  - `.env`-style files so safety checks can detect committed secrets
- Bound scanning:
  - Max 200 files
  - Max 20 KB per file
- Apply case or assessment `ignoreGlobs`
- If `repoPath` does not exist, continue with a warning instead of failing the whole run.

## Assessment Workflow

`assess` is the primary workflow.

Supported brief sources:

- `--brief <text>`
- `--brief-file <path>`
- `--case <casePath>`

Assessment cases are JSON and may include:

- `id`
- `title`
- `repoPath`
- `appBrief` or legacy-compatible `task`
- `expectedAreas` or legacy-compatible `expectedFiles`
- `ignoreGlobs`

`expectedAreas` are advisory. They may name repository paths, app surfaces, workflows, or configuration areas, and they are not hidden gold labels.

Readiness dimensions:

- Product Coherence
- Runtime Health
- UX Completeness
- Maintainability
- Safety
- Agent Readiness

Readiness verdicts:

- `ready`
- `conditionally-ready`
- `not-ready`
- `unknown`

## Execution Policies

- `inspect`: scan repository contents without running commands.
- `check`: run declared `typecheck`, `build`, and `test` scripts only if `node_modules` already exists.
- `sandboxed`: reserved term; currently skipped with a clear message.
- `trusted`: reserved term; currently skipped with a clear message.

Default assessment must not install dependencies, launch dev servers, or call external APIs.

Under `--policy check`, execution checks may run local package scripts in the target repository only when dependencies are already present.

## Provider Mode

Provider mode is explicit and additive.

For readiness assessment:

```bash
pnpm ghostbench assess <repoPath> --brief <text> --provider openai --model <model>
```

Ghostbench still computes the deterministic readiness assessment locally, then asks OpenAI for a bounded provider-assisted review using the scanned repo context and assessment results.

For the legacy agent-response workflow:

```bash
pnpm ghostbench run <casePath> --provider openai --model <model>
pnpm ghostbench compare <casePath> --provider openai --model <model>
```

OpenAI provider mode uses `OPENAI_API_KEY` from the environment and fails clearly when it is missing. Provider or network/API failures are runtime failures, not repo warnings.

## Reports

Every successful readiness assessment writes a durable report under:

```text
reports/{assessmentId}-{timestamp}.md
```

With `--output json`, Ghostbench writes:

```text
reports/{assessmentId}-{timestamp}.json
```

Readiness reports include the app brief, repo summary, warnings, framework signals, script inventory, execution checks, dimension scores, blocking concerns, evidence, concerns, provider review when present, and remediation guidance.

Console summaries should stay compact: verdict, score, policy, report path, warnings, blocking concerns, dimension scores, and the highest-signal next fix.

Baseline comparison accepts a prior JSON readiness report produced by `--output json`. Under `--policy check`, a detected regression exits nonzero so the command can act as a quality ratchet.

## Doctor

`pnpm ghostbench doctor` should verify:

- package scripts
- README coverage
- agent instructions
- report ignore rules
- fixture repositories
- check-policy self-assessment
- provider safety

It exits nonzero if any doctor check fails.

## Legacy Agent-Response Workflow

`run` and `compare` remain available for preserved repo-understanding eval cases.

Legacy case JSON should include:

- `id`
- `title`
- `repoPath` or `repoUrl`
- `task`
- `expectedFiles`
- `ignoreGlobs`
- `rubric`
- `responses`

Each response entry should include a human-readable `name` and a `fixturePath`. All paths inside a legacy eval case, including `repoPath` and `fixturePath`, resolve relative to the case file.

Legacy judging should:

- Score each rubric item from 0 to 10
- Apply rubric weights
- Look for evidence in the agent response and repo context
- Penalize invented files or symbols not found in available repo context
- Penalize unsupported confident claims
- Reward bounded implementation plans grounded in files, functions, or observed repo structure
- Produce raw score, max score, weighted score, verdict, evidence, and concerns

`compare` uses the same execution path as `run`; it changes console emphasis and warns when ranking is not meaningful.

## Repo Source Boundary

Ghostbench must retain the ability to scan existing local repositories supplied by `repoPath`.

A user-supplied `repoPath` may point anywhere the user can read, including sibling directories outside the Ghostbench checkout.

GitHub repositories may be supplied with `repoUrl` and optional `repoRef` in legacy eval cases, or with `--repo-url` and optional `--repo-ref` for `run`, `compare`, and `init-case`.

GitHub repo support should use local `git` clone/fetch behavior, not GitHub API calls.

Remote repo support should resolve to a local checkout before scanning, then reuse `loadRepoContext.ts`.

Do not copy, clone, cache, or vendor target repositories inside the Ghostbench project directory. Acquired repository material must live outside the Ghostbench checkout, such as under the user cache directory.

## Sample Cases And Fixtures

Current readiness cases include:

- `cases/ghostbench-readiness.json`
- `cases/inventory-desk-readiness.json`

Current fixture repositories include:

- `fixture-repos/coherent-vite-app`
- `fixture-repos/messy-vibe-app`

Legacy agent-response cases include:

- `cases/bagshui-layout.json`
- `cases/nightcrawler-template-update.json`

## Done Means

Before stopping after code or doc changes:

- Run `pnpm install` when dependency state may be stale
- Run `pnpm typecheck`
- Run `pnpm test`
- Run `pnpm ghostbench doctor`
- Run `pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check`
- If `OPENAI_API_KEY` is present and provider code changed, run a provider smoke test against a small case. If not present, document that provider smoke was skipped.
- Fix any errors
- Summarize the architecture and exact commands concisely

## Do Not Do

- Do not build a web UI
- Do not add a database
- Do not call external APIs unless explicit provider mode was requested
- Do not call OpenAI unless provider mode was explicitly requested
- Do not require a real Bagshui or Nightcrawler repo to exist
- Do not over-engineer provider abstractions
- Do not bury the project in dependencies
