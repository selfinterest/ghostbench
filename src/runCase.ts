import { readFile } from "node:fs/promises";
import { loadCase } from "./loadCase.js";
import { loadRepoContext } from "./loadRepoContext.js";
import { judgeResponses } from "./judge.js";
import { rankJudgments, writeMarkdownReport } from "./report.js";
import type { AgentResponse, RunResult } from "./types.js";

export async function runCase(casePath: string, mode: "run" | "compare" = "run"): Promise<RunResult> {
  const evalCase = await loadCase(casePath);
  const repoContext = await loadRepoContext(evalCase.repoPath);
  const responses = await loadResponses(evalCase.responses);
  const judgments = judgeResponses(evalCase, repoContext, responses);
  const ranking = rankJudgments(judgments);
  const warnings = [...repoContext.warnings];
  if (mode === "compare" && ranking.length < 2) {
    warnings.push("Compare mode evaluated only one agent response, so ranking is not meaningful.");
  }

  const reportPath = await writeMarkdownReport(evalCase, repoContext, judgments, warnings);

  return {
    case: evalCase,
    repoContext,
    responses,
    judgments,
    ranking,
    warnings,
    reportPath,
  };
}

async function loadResponses(responses: { name: string; resolvedFixturePath: string }[]): Promise<AgentResponse[]> {
  const loaded: AgentResponse[] = [];
  for (const response of responses) {
    loaded.push({
      name: response.name,
      fixturePath: response.resolvedFixturePath,
      text: (await readFile(response.resolvedFixturePath, "utf8")).trim(),
    });
  }
  return loaded;
}
