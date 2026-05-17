import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvalCase, Judgment, ReadinessAssessment, RepoContext, ReportFormat, RunResult } from "./types.js";

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

export async function writeReadinessReport(
  assessment: Omit<ReadinessAssessment, "reportPath">,
  format: ReportFormat = "markdown",
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportsDir = path.resolve("reports");
  const extension = format === "json" ? "json" : "md";
  const reportPath = path.join(reportsDir, `${assessment.id}-${timestamp}.${extension}`);
  await mkdir(reportsDir, { recursive: true });
  const content =
    format === "json"
      ? renderReadinessJson({ ...assessment, reportPath })
      : renderReadinessMarkdown(assessment);
  await writeFile(reportPath, content, "utf8");
  return reportPath;
}

export function renderReadinessJson(assessment: ReadinessAssessment): string {
  return `${JSON.stringify(assessment, null, 2)}\n`;
}

export function renderReadinessConsoleSummary(assessment: ReadinessAssessment): string {
  const lines: string[] = [];
  lines.push(`Assessment: ${assessment.title}`);
  lines.push(`Repo: ${assessment.repoPath}`);
  lines.push(`Verdict: ${assessment.verdict} (${assessment.score}/10)`);
  lines.push(`Policy: ${assessment.executionPolicy}`);
  if (assessment.providerReview) {
    lines.push(`Provider review: ${assessment.providerReview.provider}:${assessment.providerReview.model}`);
  }
  lines.push(`Report: ${path.relative(process.cwd(), assessment.reportPath)}`);

  if (assessment.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of assessment.warnings.slice(0, 5)) {
      lines.push(`- ${warning}`);
    }
    if (assessment.warnings.length > 5) {
      lines.push(`- ... ${assessment.warnings.length - 5} more warnings in the markdown report`);
    }
  }

  if (assessment.blockingConcerns.length > 0) {
    lines.push("");
    lines.push("Blocking concerns:");
    for (const concern of assessment.blockingConcerns.slice(0, 5)) {
      lines.push(`- ${concern}`);
    }
  }

  lines.push("");
  lines.push("Dimensions:");
  for (const dimension of assessment.dimensions) {
    const concern = dimension.concerns[0] ? ` Concern: ${dimension.concerns[0]}` : "";
    lines.push(`- ${dimension.name}: ${dimension.score}/10.${concern}`);
  }

  if (assessment.remediationGuidance.length > 0) {
    lines.push("");
    lines.push(`Next fix: ${assessment.remediationGuidance[0]}`);
  }

  if (assessment.providerReview) {
    lines.push("");
    lines.push(`OpenAI summary: ${assessment.providerReview.summary || "No summary returned."}`);
    if (assessment.providerReview.concerns[0]) {
      lines.push(`OpenAI concern: ${assessment.providerReview.concerns[0]}`);
    }
    if (assessment.providerReview.recommendations[0]) {
      lines.push(`OpenAI recommendation: ${assessment.providerReview.recommendations[0]}`);
    }
  }

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

function renderReadinessMarkdown(assessment: Omit<ReadinessAssessment, "reportPath">): string {
  const lines: string[] = [];
  lines.push(`# ${assessment.title}`);
  lines.push("");
  lines.push(`- Assessment: \`${assessment.id}\``);
  lines.push(`- Verdict: \`${assessment.verdict}\``);
  lines.push(`- Score: ${assessment.score}/10`);
  lines.push(`- Repo path: \`${assessment.repoPath}\``);
  lines.push(`- Brief source: \`${assessment.briefSource}\``);
  lines.push(`- Execution policy: \`${assessment.executionPolicy}\``);
  if (assessment.providerReview) {
    lines.push(`- Provider review: \`${assessment.providerReview.provider}:${assessment.providerReview.model}\``);
  }
  lines.push(`- Repo files scanned: ${assessment.repoContext.scannedFiles}/${assessment.repoContext.totalEligibleFiles}`);
  lines.push("");

  lines.push("## App Brief");
  lines.push("");
  lines.push(assessment.appBrief || "_No app brief supplied._");
  lines.push("");

  if (assessment.expectedAreas.length > 0) {
    lines.push("## Expected Areas");
    lines.push("");
    for (const area of assessment.expectedAreas) {
      lines.push(`- ${area}`);
    }
    lines.push("");
  }

  if (assessment.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    appendBullets(lines, assessment.warnings);
    lines.push("");
  }

  lines.push("## Framework Signals");
  lines.push("");
  if (assessment.frameworkSignals.length === 0) {
    lines.push("- None detected.");
  } else {
    for (const signal of assessment.frameworkSignals) {
      lines.push(`- **${signal.name}**: ${signal.evidence}`);
    }
  }
  lines.push("");

  lines.push("## Script Inventory");
  lines.push("");
  lines.push(`- Package manager: \`${assessment.scriptInventory.packageManager}\``);
  if (Object.keys(assessment.scriptInventory.scripts).length === 0) {
    lines.push("- Scripts: none detected.");
  } else {
    for (const [name, command] of Object.entries(assessment.scriptInventory.scripts)) {
      lines.push(`- \`${name}\`: \`${command}\``);
    }
  }
  lines.push("");

  lines.push("## Execution Checks");
  lines.push("");
  lines.push("| Check | Command | Status | Output |");
  lines.push("| --- | --- | --- | --- |");
  for (const check of assessment.executionChecks) {
    lines.push(
      `| ${escapeTable(check.name)} | \`${escapeTable(check.command)}\` | \`${check.status}\` | ${escapeTable(firstLine(check.output))} |`,
    );
  }
  lines.push("");

  lines.push("## Dimension Scores");
  lines.push("");
  lines.push("| Dimension | Score | Highest-signal concern |");
  lines.push("| --- | ---: | --- |");
  for (const dimension of assessment.dimensions) {
    lines.push(
      `| ${dimension.name} | ${dimension.score}/10 | ${escapeTable(dimension.concerns[0] ?? "None")} |`,
    );
  }
  lines.push("");

  lines.push("## Blocking Concerns");
  lines.push("");
  appendBullets(lines, assessment.blockingConcerns);
  lines.push("");

  lines.push("## Evidence");
  lines.push("");
  appendBullets(lines, assessment.evidence);
  lines.push("");

  lines.push("## Concerns");
  lines.push("");
  appendBullets(lines, assessment.concerns);
  lines.push("");

  lines.push("## Remediation Guidance");
  lines.push("");
  appendBullets(lines, assessment.remediationGuidance);
  lines.push("");

  if (assessment.providerReview) {
    lines.push("## Provider-Assisted Review");
    lines.push("");
    lines.push(`- Provider: \`${assessment.providerReview.provider}\``);
    lines.push(`- Model: \`${assessment.providerReview.model}\``);
    lines.push("");
    lines.push("### Summary");
    lines.push("");
    lines.push(assessment.providerReview.summary || "_No summary returned._");
    lines.push("");
    lines.push("### Evidence");
    lines.push("");
    appendBullets(lines, assessment.providerReview.evidence);
    lines.push("");
    lines.push("### Concerns");
    lines.push("");
    appendBullets(lines, assessment.providerReview.concerns);
    lines.push("");
    lines.push("### Recommendations");
    lines.push("");
    appendBullets(lines, assessment.providerReview.recommendations);
    lines.push("");
  }

  lines.push("## Repo Context Summary");
  lines.push("");
  if (assessment.repoContext.files.length === 0) {
    lines.push("No files were available in repo context.");
  } else {
    for (const file of assessment.repoContext.files.slice(0, 35)) {
      lines.push(`- \`${file.path}\`${file.truncated ? " (truncated)" : ""}`);
    }
    if (assessment.repoContext.files.length > 35) {
      lines.push(`- ... ${assessment.repoContext.files.length - 35} more files`);
    }
  }
  lines.push("");

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

function firstLine(value: string): string {
  const first = value.split(/\r?\n/).find((line) => line.trim().length > 0);
  return first ? first.slice(0, 180) : "";
}
