import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvalCase, Judgment, RepoContext, RunResult } from "./types.js";

export async function writeMarkdownReport(
  evalCase: EvalCase,
  repoContext: RepoContext,
  judgments: Judgment[],
  warnings: string[],
): Promise<string> {
  const ranking = rankJudgments(judgments);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportsDir = path.resolve("reports");
  const reportPath = path.join(reportsDir, `${evalCase.id}-${timestamp}.md`);
  await mkdir(reportsDir, { recursive: true });
  await writeFile(reportPath, renderMarkdown(evalCase, repoContext, ranking, warnings), "utf8");
  return reportPath;
}

export function rankJudgments(judgments: Judgment[]): Judgment[] {
  const verdictRank = { strong: 0, acceptable: 1, weak: 2 };
  return [...judgments].sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) {
      return b.weightedScore - a.weightedScore;
    }
    if (verdictRank[a.verdict] !== verdictRank[b.verdict]) {
      return verdictRank[a.verdict] - verdictRank[b.verdict];
    }
    return a.responseName.localeCompare(b.responseName);
  });
}

export function renderConsoleSummary(result: RunResult, mode: "run" | "compare"): string {
  const lines: string[] = [];
  lines.push(`${mode === "compare" ? "Comparison" : "Run"}: ${result.case.title}`);
  lines.push(`Case: ${result.case.id}`);
  lines.push(`Report: ${path.relative(process.cwd(), result.reportPath)}`);

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings.slice(0, 5)) {
      lines.push(`- ${warning}`);
    }
    if (result.warnings.length > 5) {
      lines.push(`- ... ${result.warnings.length - 5} more warnings in the markdown report`);
    }
  }

  lines.push("");
  lines.push(result.ranking.length > 1 ? "Ranking:" : "Judgment:");
  result.ranking.forEach((judgment, index) => {
    const prefix = result.ranking.length > 1 ? `${index + 1}. ` : "- ";
    const concern = judgment.concerns[0] ? ` Concern: ${judgment.concerns[0]}` : "";
    lines.push(`${prefix}${judgment.responseName}: ${judgment.weightedScore}/10 (${judgment.verdict}).${concern}`);
  });

  return lines.join("\n");
}

function renderMarkdown(
  evalCase: EvalCase,
  repoContext: RepoContext,
  ranking: Judgment[],
  warnings: string[],
): string {
  const lines: string[] = [];
  lines.push(`# ${evalCase.title}`);
  lines.push("");
  lines.push(`- Case: \`${evalCase.id}\``);
  lines.push(`- Repo source: \`${repoContext.repoSource}\``);
  lines.push(`- Resolved repo path: \`${repoContext.repoPath}\``);
  lines.push(`- Repo files scanned: ${repoContext.scannedFiles}/${repoContext.totalEligibleFiles}`);
  lines.push("");
  lines.push("## Task");
  lines.push("");
  lines.push(evalCase.task);
  lines.push("");

  if (evalCase.expectedFiles.length > 0) {
    lines.push("## Expected Files");
    lines.push("");
    for (const expected of evalCase.expectedFiles) {
      lines.push(`- \`${expected}\``);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  lines.push("## Repo Context Summary");
  lines.push("");
  if (repoContext.files.length === 0) {
    lines.push("No files were available in repo context.");
  } else {
    for (const file of repoContext.files.slice(0, 25)) {
      lines.push(`- \`${file.path}\`${file.truncated ? " (truncated)" : ""}`);
    }
    if (repoContext.files.length > 25) {
      lines.push(`- ... ${repoContext.files.length - 25} more files`);
    }
  }
  lines.push("");

  lines.push("## Score Table");
  lines.push("");
  lines.push("| Rank | Agent Response | Weighted Score | Verdict | Source |");
  lines.push("| --- | --- | ---: | --- | --- |");
  ranking.forEach((judgment, index) => {
    lines.push(
      `| ${ranking.length > 1 ? index + 1 : "-"} | ${escapeTable(judgment.responseName)} | ${judgment.weightedScore}/10 | ${judgment.verdict} | \`${judgment.responseSource}\` |`,
    );
  });
  lines.push("");

  for (const judgment of ranking) {
    lines.push(`## ${judgment.responseName}`);
    lines.push("");
    lines.push(`- Verdict: \`${judgment.verdict}\``);
    lines.push(`- Weighted score: ${judgment.weightedScore}/10`);
    lines.push(`- Raw score: ${judgment.rawScore}/${judgment.maxScore}`);
    lines.push(`- Source: \`${judgment.responseSource}\``);
    lines.push(`- Source type: \`${judgment.responseSourceType}\``);
    lines.push("");
    lines.push("### Rubric Scores");
    lines.push("");
    lines.push("| Rubric Item | Score | Weight | Weighted |");
    lines.push("| --- | ---: | ---: | ---: |");
    for (const score of judgment.rubricScores) {
      lines.push(
        `| \`${score.rubricItemId}\` ${escapeTable(score.description)} | ${score.rawScore}/10 | ${score.weight} | ${score.weightedScore} |`,
      );
    }
    lines.push("");
    lines.push("### Evidence");
    lines.push("");
    appendBullets(lines, judgment.evidence);
    lines.push("");
    lines.push("### Concerns");
    lines.push("");
    appendBullets(lines, judgment.concerns);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function appendBullets(lines: string[], items: string[]): void {
  if (items.length === 0) {
    lines.push("- None.");
    return;
  }
  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|");
}
