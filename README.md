# Ghostbench

Ghostbench is a local-first TypeScript CLI for evaluating repo-aware coding agents before they make changes.

It asks one question: did the agent demonstrate repo understanding, or did it produce a plausible generic plan?

The default workflow runs entirely offline. It evaluates markdown fixture responses against JSON eval cases, uses a deterministic heuristic judge, prints a console summary, and writes a markdown report.

Ghostbench can also generate a live Agent Response with OpenAI when explicitly requested. Provider-generated responses are judged by the same deterministic heuristic judge as fixture responses.

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

## Generate An OpenAI Agent Response

Fixture responses remain enabled in provider mode. The generated Agent Response is added to the run and appears in the same report and ranking:

```bash
OPENAI_API_KEY=... pnpm ghostbench run cases/bagshui-layout.json --provider openai --model gpt-5.1
OPENAI_API_KEY=... pnpm ghostbench compare cases/bagshui-layout.json --provider openai --model gpt-5.1
```

OpenAI provider mode uses the bounded repo context scanned by Ghostbench and fails clearly if `OPENAI_API_KEY` is missing or the API request fails. The provider is only for Agent Response generation; judging remains deterministic and local.

## Add A Case

Create a starter case:

```bash
pnpm ghostbench init-case
```

Create a starter case for a GitHub repository:

```bash
pnpm ghostbench init-case --repo-url https://github.com/owner/repo.git --repo-ref main --id my-case --title "My repo eval"
```

For remote cases, `init-case` clones or updates the repo in the user cache, scans the bounded repo context, suggests a small `expectedFiles` list, and creates two placeholder fixture responses under `fixtures/`.

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

`repoPath` points to the target repository being evaluated. It can point at an existing local repository outside Ghostbench, such as a sibling checkout under `~/Code`. Ghostbench does not copy or vendor target repositories into this project.

You can also point a run at a GitHub repository:

```bash
pnpm ghostbench run cases/my-case.json --repo-url https://github.com/owner/repo.git --repo-ref main
```

Or put the remote source in the case file:

```json
{
  "repoUrl": "https://github.com/owner/repo.git",
  "repoRef": "main"
}
```

`repoRef` is optional, but pinning a branch, tag, or commit makes reports easier to interpret. GitHub repositories are cloned or updated into the user cache outside the Ghostbench checkout, then scanned with the same bounded repo-context scanner as local repositories.

## Reports

Reports are written to:

```text
reports/{caseId}-{timestamp}.md
```

Each report includes the task, repo context summary, warnings, expected files, response names, response sources, per-rubric scores, evidence, concerns, and ranking when multiple responses are evaluated.

Generated reports are gitignored by default.

## Roadmap

- Anthropic provider adapter
- LLM-as-judge
- MCP server tools:
  - `run_eval_case`
  - `compare_model_runs`
  - `inspect_failure`
- GitHub PR comment mode
- Grill mode that asks follow-up questions before scoring
