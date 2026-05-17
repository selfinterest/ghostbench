# Ghostbench

Ghostbench is a local-first TypeScript CLI for assessing vibe-coded application repositories.

It answers one question for an app owner: is this repository ready to ship, hand off, or keep developing with agents?

The default workflow is deterministic and offline. Ghostbench scans a repository, detects framework signals, inventories package scripts, runs only the execution checks allowed by the selected policy, and writes a readiness report with evidence, concerns, blocking concerns, dimension scores, and remediation guidance.

## Install

```bash
pnpm install
```

## Assess A Repository

Assess a repository with an inline app brief:

```bash
pnpm ghostbench assess ./fixture-repos/coherent-vite-app --brief "Inventory Desk is an operations dashboard for tracking low-stock items, supplier status, and reorder decisions."
```

Assess with a reusable case file:

```bash
pnpm ghostbench assess . --case cases/inventory-desk-readiness.json
```

Emit a machine-readable JSON assessment and write a JSON report:

```bash
pnpm ghostbench assess . --case cases/inventory-desk-readiness.json --policy check --output json
```

Compare the current assessment against a previous JSON report:

```bash
pnpm ghostbench assess . --case cases/inventory-desk-readiness.json --policy check --baseline reports/previous.json
```

With `--baseline`, Ghostbench reports score movement, new and resolved concerns, and dimension-level improvements or regressions. Under `--policy check`, a detected regression exits nonzero so the command can act as a quality ratchet in CI or agent workflows.

Run a self-assessment of the Ghostbench checkout:

```bash
pnpm ghostbench doctor
```

`doctor` checks package scripts, the README, agent instructions, report ignore rules, fixture repositories, check-policy assessment, and OpenAI provider safety.

Use `--policy inspect` for static-only evaluation. Use `--policy check` to run declared typecheck, build, and test scripts only when dependencies are already present:

```bash
pnpm ghostbench assess ./fixture-repos/coherent-vite-app --case cases/inventory-desk-readiness.json --policy check
```

`sandboxed` and `trusted` policies are reserved terms in the MVP; they do not yet install dependencies or launch dev servers.

Add an OpenAI provider review to the deterministic readiness report. `OPENAI_API_KEY` must already be set in the environment:

```bash
pnpm ghostbench assess . --brief "Ghostbench is a local-first TypeScript CLI for evaluating how well coding agents understand a repository before proposing changes." --policy check --provider openai --model <model>
```

Provider mode is explicit and additive. Ghostbench still computes the deterministic readiness score locally, then asks OpenAI for a bounded review using the scanned repo context and assessment results.

## Readiness Dimensions

Ghostbench scores six dimensions:

- Product Coherence
- Runtime Health
- UX Completeness
- Maintainability
- Safety
- Agent Readiness

Verdicts are `ready`, `conditionally-ready`, `not-ready`, or `unknown`.

## App Briefs And Cases

The app brief describes the product intent and user expectations. It can come from:

- `--brief <text>`
- `--brief-file <path>`
- `--case <casePath>`

Assessment cases are reusable JSON files:

```json
{
  "id": "inventory-desk-readiness",
  "title": "Inventory Desk readiness assessment",
  "repoPath": "../fixture-repos/coherent-vite-app",
  "appBrief": "Inventory Desk is an operations dashboard for tracking low-stock items, reviewing supplier status, and preparing reorder decisions.",
  "expectedAreas": ["inventory summary", "supplier status", "reorder decisions", "src"],
  "ignoreGlobs": ["reports/**"]
}
```

`expectedAreas` are advisory. They can name repository paths, app surfaces, workflows, or configuration areas, and they are not hidden gold labels.
`ignoreGlobs` are optional repository-relative patterns for files that should not enter repo context, such as generated reports or logs.

## Execution Policies

- `inspect`: scan repository contents without running commands.
- `check`: run declared `typecheck`, `build`, and `test` scripts only if `node_modules` already exists.
- `sandboxed`: reserved for future isolated install/run support.
- `trusted`: reserved for future explicit in-repository install/run support.

Ghostbench does not call external APIs or install dependencies during the default readiness workflow. OpenAI is called only when `--provider openai --model <model>` is supplied.

## Reports

Reports are written to:

```text
reports/{assessmentId}-{timestamp}.md
```

Each report includes the app brief, repo summary, warnings, framework signals, script inventory, execution checks, dimension scores, blocking concerns, evidence, concerns, and remediation guidance.

Use `--output json` to print the full readiness assessment as JSON and write the durable report to:

```text
reports/{assessmentId}-{timestamp}.json
```

Generated reports are gitignored by default.

Baseline comparison accepts a prior JSON readiness report produced by `--output json`. The current run still writes its normal markdown or JSON report, then compares stable concern IDs and dimension scores against the baseline.

## Fixture Repositories

The repo includes deterministic local fixture repositories:

- `fixture-repos/coherent-vite-app`
- `fixture-repos/messy-vibe-app`

These let Ghostbench exercise readiness assessment without depending on external repositories.

## Legacy Agent-Response Workflow

The older repo-understanding workflow is still available while the pivot lands:

```bash
pnpm ghostbench run cases/bagshui-layout.json
pnpm ghostbench compare cases/bagshui-layout.json
```

That workflow evaluates fixture agent responses. New product work should target `assess`.

## Roadmap

- Sandboxed and trusted execution policies
- Optional provider-assisted assessment
- Interactive browser checks
- Patch generation as a separate capability
- Multi-repository comparison
- Additional app stacks beyond Node and TypeScript
- MCP server tools for readiness assessment and failure inspection
