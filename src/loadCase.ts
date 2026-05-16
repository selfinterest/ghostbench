import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { CaseResponse, EvalCase, RepoSource, RubricItem } from "./types.js";

interface RawCase {
  id?: unknown;
  title?: unknown;
  repoPath?: unknown;
  repoUrl?: unknown;
  repoRef?: unknown;
  task?: unknown;
  expectedFiles?: unknown;
  rubric?: unknown;
  responses?: unknown;
}

interface RawRubricItem {
  id?: unknown;
  description?: unknown;
  weight?: unknown;
}

interface RawResponse {
  name?: unknown;
  fixturePath?: unknown;
}

export async function loadCase(casePath: string): Promise<EvalCase> {
  const resolvedCasePath = path.resolve(casePath);
  const caseDir = path.dirname(resolvedCasePath);
  const rawText = await readFile(resolvedCasePath, "utf8");
  let raw: RawCase;

  try {
    raw = JSON.parse(rawText) as RawCase;
  } catch (error) {
    throw new Error(`Invalid case JSON at ${casePath}: ${formatError(error)}`);
  }

  const errors: string[] = [];
  const id = requireString(raw.id, "id", errors);
  const title = requireString(raw.title, "title", errors);
  const repoSource = readRepoSource(raw, caseDir, errors);
  const task = requireString(raw.task, "task", errors);
  const expectedFiles = readStringArray(raw.expectedFiles, "expectedFiles", errors, []);
  const rubric = readRubric(raw.rubric, errors);
  const responses = await readResponses(raw.responses, caseDir, errors);

  if (errors.length > 0) {
    throw new Error(`Invalid eval case ${casePath}:\n- ${errors.join("\n- ")}`);
  }

  return {
    id,
    title,
    repoSource,
    task,
    expectedFiles,
    rubric,
    responses,
    casePath: resolvedCasePath,
    caseDir,
  };
}

function readRepoSource(raw: RawCase, caseDir: string, errors: string[]): RepoSource {
  const repoPathValue = typeof raw.repoPath === "string" ? raw.repoPath.trim() : "";
  const repoUrlValue = typeof raw.repoUrl === "string" ? raw.repoUrl.trim() : "";
  const hasRepoPath = repoPathValue.length > 0;
  const hasRepoUrl = repoUrlValue.length > 0;

  if (hasRepoPath && hasRepoUrl) {
    errors.push("Use either repoPath or repoUrl, not both");
  }

  if (hasRepoUrl) {
    const ref = typeof raw.repoRef === "string" && raw.repoRef.trim().length > 0 ? raw.repoRef.trim() : undefined;
    return {
      type: "github",
      url: repoUrlValue,
      ...(ref ? { ref } : {}),
    };
  }

  if (hasRepoPath) {
    return {
      type: "local",
      path: path.resolve(caseDir, repoPathValue),
    };
  }

  errors.push("Either repoPath or repoUrl must be provided");
  return {
    type: "local",
    path: caseDir,
  };
}

function requireString(value: unknown, field: string, errors: string[]): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return "";
  }
  return value.trim();
}

function readStringArray(
  value: unknown,
  field: string,
  errors: string[],
  fallback: string[],
): string[] {
  if (value === undefined) {
    return fallback;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings`);
    return fallback;
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      errors.push(`${field} entries must be non-empty strings`);
      continue;
    }
    result.push(item.trim());
  }
  return result;
}

function readRubric(value: unknown, errors: string[]): RubricItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("rubric must contain at least one rubric item");
    return [];
  }

  return value.map((item, index) => {
    const raw = item as RawRubricItem;
    const id = requireString(raw.id, `rubric[${index}].id`, errors);
    const description = requireString(raw.description, `rubric[${index}].description`, errors);
    const weight = typeof raw.weight === "number" ? raw.weight : Number.NaN;

    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push(`rubric[${index}].weight must be a positive number`);
    }

    return { id, description, weight: Number.isFinite(weight) ? weight : 1 };
  });
}

async function readResponses(
  value: unknown,
  caseDir: string,
  errors: string[],
): Promise<CaseResponse[]> {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push("responses must contain at least one response");
    return [];
  }

  const responses: CaseResponse[] = [];
  for (const [index, item] of value.entries()) {
    const raw = item as RawResponse;
    const name = requireString(raw.name, `responses[${index}].name`, errors);
    const fixturePath = requireString(raw.fixturePath, `responses[${index}].fixturePath`, errors);
    const resolvedFixturePath = path.resolve(caseDir, fixturePath);

    if (fixturePath) {
      try {
        await access(resolvedFixturePath);
        const content = (await readFile(resolvedFixturePath, "utf8")).trim();
        if (content.length === 0) {
          errors.push(`responses[${index}].fixturePath points to an empty fixture`);
        }
      } catch {
        errors.push(`responses[${index}].fixturePath does not exist or is unreadable: ${fixturePath}`);
      }
    }

    responses.push({ name, fixturePath, resolvedFixturePath });
  }

  return responses;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
