import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadRepoContext } from "./loadRepoContext.js";
import { createProvider, type ProviderOptions } from "./providers/index.js";
import {
  averageDimensionScore,
  buildRemediationGuidance,
  findBlockingConcerns,
  readinessVerdict,
  scoreDimensions,
  unique,
} from "./assessScoring.js";
import { detectFrameworkSignals, readScriptInventory, runExecutionChecks } from "./assessRuntime.js";
import type {
  AssessmentCase,
  ExecutionPolicy,
  ReadinessAssessment,
} from "./types.js";
import { writeReadinessReport } from "./report.js";

export interface AssessOptions {
  repoPath: string;
  appBrief: string;
  briefSource: string;
  expectedAreas?: string[];
  title?: string;
  id?: string;
  policy?: ExecutionPolicy;
  provider?: ProviderOptions;
}

export async function assessRepository(options: AssessOptions): Promise<ReadinessAssessment> {
  const executionPolicy = options.policy ?? "inspect";
  const repoContext = await loadRepoContext(options.repoPath);
  const scriptInventory = readScriptInventory(repoContext);
  const frameworkSignals = detectFrameworkSignals(repoContext, scriptInventory);
  const executionChecks = await runExecutionChecks(repoContext.repoPath, executionPolicy, scriptInventory);
  const warnings = [...repoContext.warnings, ...scriptInventory.warnings];

  if (frameworkSignals.length === 0) {
    warnings.push("No first-class Node/TypeScript application framework signals were detected; assessment may be reduced.");
  }
  if (options.appBrief.trim().length === 0) {
    warnings.push("No explicit app brief was supplied; assessment confidence is lower.");
  }

  const dimensions = scoreDimensions({
    repoContext,
    scriptInventory,
    frameworkSignals,
    executionChecks,
    appBrief: options.appBrief,
    expectedAreas: options.expectedAreas ?? [],
  });
  const score = averageDimensionScore(dimensions);
  const concerns = unique(dimensions.flatMap((dimension) => dimension.concerns));
  const evidence = unique(dimensions.flatMap((dimension) => dimension.evidence));
  const blockingConcerns = findBlockingConcerns(repoContext, scriptInventory, executionChecks, concerns, options.appBrief);
  const verdict = readinessVerdict(score, blockingConcerns, warnings, repoContext.exists);
  const remediationGuidance = buildRemediationGuidance(dimensions, blockingConcerns, executionChecks, scriptInventory);
  const providerReview = options.provider
    ? await createProvider(options.provider).generateReadinessReview({
        model: options.provider.model,
        title: options.title ?? `Readiness assessment for ${path.basename(repoContext.repoPath)}`,
        appBrief: options.appBrief,
        repoPath: repoContext.repoPath,
        briefSource: options.briefSource,
        executionPolicy,
        repoContext,
        expectedAreas: options.expectedAreas ?? [],
        frameworkSignals,
        scriptInventory,
        executionChecks,
        dimensions,
        deterministicScore: score,
        deterministicVerdict: verdict,
        deterministicConcerns: concerns,
        deterministicEvidence: evidence,
      })
    : undefined;

  const partial: Omit<ReadinessAssessment, "reportPath"> = {
    id: options.id ?? slugify(path.basename(repoContext.repoPath) || "assessment"),
    title: options.title ?? `Readiness assessment for ${path.basename(repoContext.repoPath)}`,
    repoPath: repoContext.repoPath,
    appBrief: options.appBrief,
    briefSource: options.briefSource,
    executionPolicy,
    repoContext,
    expectedAreas: options.expectedAreas ?? [],
    frameworkSignals,
    scriptInventory,
    executionChecks,
    dimensions,
    score,
    verdict,
    evidence,
    concerns,
    blockingConcerns,
    remediationGuidance,
    ...(providerReview ? { providerReview } : {}),
    warnings,
  };

  const reportPath = await writeReadinessReport(partial);
  return { ...partial, reportPath };
}

export async function loadAssessmentCase(casePath: string): Promise<AssessmentCase> {
  const resolvedCasePath = path.resolve(casePath);
  const caseDir = path.dirname(resolvedCasePath);
  const rawText = await readFile(resolvedCasePath, "utf8");
  let raw: Record<string, unknown>;

  try {
    raw = JSON.parse(rawText) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid assessment case JSON at ${casePath}: ${formatError(error)}`);
  }

  const errors: string[] = [];
  const id = readRequiredString(raw.id, "id", errors);
  const title = readRequiredString(raw.title, "title", errors);
  const appBrief = readRequiredString(raw.appBrief ?? raw.task, "appBrief", errors);
  const expectedAreas = readStringArray(raw.expectedAreas ?? raw.expectedFiles, "expectedAreas", errors);
  const repoPath = typeof raw.repoPath === "string" && raw.repoPath.trim().length > 0 ? raw.repoPath.trim() : undefined;

  if (errors.length > 0) {
    throw new Error(`Invalid assessment case ${casePath}:\n- ${errors.join("\n- ")}`);
  }

  return {
    id,
    title,
    appBrief,
    expectedAreas,
    ...(repoPath ? { repoSource: { type: "local", path: path.resolve(caseDir, repoPath) } } : {}),
    casePath: resolvedCasePath,
    caseDir,
  };
}

function readRequiredString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function readStringArray(value: unknown, field: string, errors: string[]): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings`);
    return [];
  }
  return value.flatMap((item) => (typeof item === "string" && item.trim().length > 0 ? [item.trim()] : []));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "assessment";
}
