# Ghostbench

Ghostbench is a local-first TypeScript CLI for evaluating repo-aware coding agents before they make changes.

It asks one question: did the agent demonstrate repo understanding, or did it produce a plausible generic plan?

The MVP runs entirely offline. It evaluates markdown fixture responses against JSON eval cases, uses a deterministic heuristic judge, prints a console summary, and writes a markdown report.

## Install

```bash
pnpm install
```

## Run Sample Cases

```bash
pnpm ghostbench run cases/bagshui-layout.json
pnpm ghostbench compare cases/bagshui-layout.json
pnpm ghostbench run cases/nightcrawler-template-update.json
```

If a sample target repository is not present next to this repo, Ghostbench continues with a warning. Missing repo context is part of what the fixtures are meant to exercise.

## Add A Case

Create a starter case:

```bash
pnpm ghostbench init-case
```

Eval case paths are resolved relative to the case file. MVP cases reference local fixture-backed agent responses:

```json
{
  "id": "my-case",
  "title": "My repo-aware eval",
  "repoPath": "../my-target-repo",
  "task": "Answer a realistic repository task.",
  "expectedFiles": ["src/relevant-area"],
  "rubric": [
    {
      "id": "grounded-plan",
      "description": "Identifies task-relevant repository areas and proposes a bounded plan",
      "weight": 3
    }
  ],
  "responses": [
    {
      "name": "Candidate response",
      "fixturePath": "../fixtures/candidate-response.md"
    }
  ]
}
```

`expectedFiles` are advisory. They help judge repo understanding, but they are not hidden gold labels.

## Reports

Reports are written to:

```text
reports/{caseId}-{timestamp}.md
```

Each report includes the task, repo context summary, warnings, expected files, response names, fixture paths, per-rubric scores, evidence, concerns, and ranking when multiple responses are evaluated.

Generated reports are gitignored by default.

## Roadmap

- OpenAI and Anthropic provider adapters
- LLM-as-judge
- MCP server tools:
  - `run_eval_case`
  - `compare_model_runs`
  - `inspect_failure`
- GitHub PR comment mode
- Grill mode that asks follow-up questions before scoring
