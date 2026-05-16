import { readFile } from "node:fs/promises";
import { loadCase } from "./loadCase.js";
import { loadRepoContext } from "./loadRepoContext.js";
import { resolveRepoSource } from "./resolveRepoSource.js";
import { judgeResponses } from "./judge.js";
import { createProvider, type ProviderOptions } from "./providers/index.js";
import { rankJudgments, writeMarkdownReport } from "./report.js";
import type { AgentResponse, GitHubRepoSource, RepoSource, RunResult } from "./types.js";

export interface RunCaseOptions {
  mode?: "run" | "compare";
  repoOverride?: RepoSource;
  provider?: ProviderOptions;
}

export async function runCase(casePath: string, options: RunCaseOptions = {}): Promise<RunResult> {
  const evalCase = await loadCase(casePath);
  const repoSource = options.repoOverride ?? evalCase.repoSource;
  const resolvedRepoSource = await resolveRepoSource(repoSource);
  const repoContext = await loadRepoContext(resolvedRepoSource.localPath, resolvedRepoSource.sourceLabel);
  const responses = await loadResponses(evalCase.responses);
  if (options.provider) {
    const provider = createProvider(options.provider);
    responses.push(
      await provider.generate({
        evalCase,
        repoContext,
        model: options.provider.model,
      }),
    );
  }
  const judgments = judgeResponses(evalCase, repoContext, responses);
  const ranking = rankJudgments(judgments);
  const warnings = [...resolvedRepoSource.warnings, ...repoContext.warnings];
  if (options.mode === "compare" && ranking.length < 2) {
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

export function githubRepoOverride(url: string, ref?: string): GitHubRepoSource {
  return {
    type: "github",
    url,
    ...(ref ? { ref } : {}),
  };
}

async function loadResponses(responses: { name: string; resolvedFixturePath: string }[]): Promise<AgentResponse[]> {
  const loaded: AgentResponse[] = [];
  for (const response of responses) {
    loaded.push({
      name: response.name,
      sourceType: "fixture",
      source: response.resolvedFixturePath,
      text: (await readFile(response.resolvedFixturePath, "utf8")).trim(),
    });
  }
  return loaded;
}
