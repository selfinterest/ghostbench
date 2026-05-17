import { readFile } from "node:fs/promises";
import type {
  ConcernDelta,
  DimensionDelta,
  DimensionScore,
  ReadinessAssessment,
  ReadinessRegression,
  ReadinessRegressionStatus,
} from "./types.js";

const SCORE_EPSILON = 0.05;

export async function loadBaselineAssessment(filePath: string): Promise<ReadinessAssessment> {
  const rawText = await readFile(filePath, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid baseline JSON at ${filePath}: ${reason}`);
  }

  if (!isBaselineAssessment(raw)) {
    throw new Error(`Baseline ${filePath} is not a Ghostbench readiness assessment JSON report.`);
  }
  return raw;
}

export function compareReadinessAssessments(
  previous: ReadinessAssessment,
  current: ReadinessAssessment,
  baselineReportPath?: string,
): ReadinessRegression {
  const delta = round2(current.score - previous.score);
  const status = regressionStatus(delta, previous, current);

  return {
    status,
    previousScore: previous.score,
    currentScore: current.score,
    delta,
    previousVerdict: previous.verdict,
    currentVerdict: current.verdict,
    newBlockingConcerns: newConcerns(previous.blockingConcerns, current.blockingConcerns),
    newConcerns: newConcerns(previous.concerns, current.concerns),
    resolvedBlockingConcerns: newConcerns(current.blockingConcerns, previous.blockingConcerns),
    resolvedConcerns: newConcerns(current.concerns, previous.concerns),
    improved: dimensionDeltas(previous.dimensions, current.dimensions, "improved"),
    regressed: dimensionDeltas(previous.dimensions, current.dimensions, "regressed"),
    ...(baselineReportPath ? { baselineReportPath } : {}),
    currentReportPath: current.reportPath,
  };
}

export function hasReadinessRegression(regression: ReadinessRegression): boolean {
  return regression.status === "regressed" || regression.newBlockingConcerns.length > 0;
}

function regressionStatus(
  delta: number,
  previous: ReadinessAssessment,
  current: ReadinessAssessment,
): ReadinessRegressionStatus {
  if (newConcerns(previous.blockingConcerns, current.blockingConcerns).length > 0 || delta < -SCORE_EPSILON) {
    return "regressed";
  }
  if (delta > SCORE_EPSILON || newConcerns(current.blockingConcerns, previous.blockingConcerns).length > 0) {
    return "improved";
  }
  return "unchanged";
}

function newConcerns(previous: string[], current: string[]): ConcernDelta[] {
  const previousIds = new Set(previous.map(concernId));
  return current
    .map((text) => ({ id: concernId(text), text }))
    .filter((concern) => !previousIds.has(concern.id));
}

function dimensionDeltas(
  previous: DimensionScore[],
  current: DimensionScore[],
  direction: "improved" | "regressed",
): DimensionDelta[] {
  const previousById = new Map(previous.map((dimension) => [dimension.id, dimension]));
  const deltas: DimensionDelta[] = [];

  for (const currentDimension of current) {
    const previousDimension = previousById.get(currentDimension.id);
    if (!previousDimension) {
      continue;
    }
    const delta = round2(currentDimension.score - previousDimension.score);
    if (direction === "improved" && delta <= SCORE_EPSILON) {
      continue;
    }
    if (direction === "regressed" && delta >= -SCORE_EPSILON) {
      continue;
    }
    deltas.push({
      id: currentDimension.id,
      name: currentDimension.name,
      previousScore: previousDimension.score,
      currentScore: currentDimension.score,
      delta,
      evidence: uniqueNew(previousDimension.evidence, currentDimension.evidence),
      concerns: uniqueNew(previousDimension.concerns, currentDimension.concerns),
    });
  }

  return deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name));
}

function uniqueNew(previous: string[], current: string[]): string[] {
  const previousIds = new Set(previous.map(concernId));
  return current.filter((item) => !previousIds.has(concernId(item)));
}

function concernId(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/\b(pnpm|npm|yarn)\s+run\s+/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9./:_ -]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 96);
}

function isBaselineAssessment(value: unknown): value is ReadinessAssessment {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ReadinessAssessment>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.repoPath === "string" &&
    typeof candidate.score === "number" &&
    typeof candidate.verdict === "string" &&
    Array.isArray(candidate.dimensions) &&
    Array.isArray(candidate.concerns) &&
    Array.isArray(candidate.blockingConcerns) &&
    typeof candidate.reportPath === "string"
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
