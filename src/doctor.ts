import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { assessRepository, loadAssessmentCase } from "./assess.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  detail: string;
}

export interface DoctorResult {
  checks: DoctorCheck[];
  reportPath?: string;
}

export async function runDoctor(repoPath = process.cwd()): Promise<DoctorResult> {
  const root = path.resolve(repoPath);
  const checks: DoctorCheck[] = [];

  checks.push(await checkPackageScripts(root));
  checks.push(await checkReadme(root));
  checks.push(await checkAgentInstructions(root));
  checks.push(await checkReportsGitignored(root));
  checks.push(await checkFixtureRepo(root));
  checks.push(await checkProviderSafety(root));

  const assessmentCheck = await checkAssessment(root);
  checks.push(assessmentCheck.check);

  return {
    checks,
    ...(assessmentCheck.reportPath ? { reportPath: assessmentCheck.reportPath } : {}),
  };
}

export function renderDoctorSummary(result: DoctorResult): string {
  const lines: string[] = [];
  lines.push("Ghostbench doctor");
  lines.push("");
  for (const check of result.checks) {
    lines.push(`${statusLabel(check.status)} ${check.name}: ${check.detail}`);
  }
  if (result.reportPath) {
    lines.push("");
    lines.push(`Assessment report: ${path.relative(process.cwd(), result.reportPath)}`);
  }
  lines.push("");
  lines.push(`Result: ${result.checks.some((check) => check.status === "fail") ? "failed" : "passed"}`);
  return lines.join("\n");
}

function statusLabel(status: DoctorStatus): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  return "FAIL";
}

async function checkPackageScripts(root: string): Promise<DoctorCheck> {
  const packageJson = await readJson(path.join(root, "package.json"));
  if (!packageJson) {
    return fail("package.json scripts", "package.json is missing or unreadable.");
  }

  const scripts = readStringRecord(packageJson.scripts);
  const required = ["ghostbench", "typecheck"];
  const missing = required.filter((script) => !scripts[script]);
  if (missing.length > 0) {
    return fail("package.json scripts", `Missing required script(s): ${missing.join(", ")}.`);
  }

  const helpful = ["build", "test"].filter((script) => scripts[script]);
  const missingHelpful = ["build", "test"].filter((script) => !scripts[script]);
  if (missingHelpful.length > 0) {
    return warn("package.json scripts", `Usable core scripts found; optional script(s) missing: ${missingHelpful.join(", ")}.`);
  }

  return pass("package.json scripts", `Found ghostbench, typecheck, and ${helpful.join(", ")} scripts.`);
}

async function checkReadme(root: string): Promise<DoctorCheck> {
  const readme = await readText(path.join(root, "README.md"));
  if (!readme) {
    return fail("README explains app", "README.md is missing or empty.");
  }

  const namesApp = /\bGhostbench\b/i.test(readme);
  const explainsPurpose = /(local-first|repo-aware|coding-agent|evaluat|assess|readiness)/i.test(readme);
  if (!namesApp || !explainsPurpose) {
    return fail("README explains app", "README.md exists but does not clearly describe Ghostbench's purpose.");
  }

  return pass("README explains app", "README.md names Ghostbench and describes the assessment/evaluation purpose.");
}

async function checkAgentInstructions(root: string): Promise<DoctorCheck> {
  const candidates = ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"];
  const existing = await existingFiles(root, candidates);
  if (existing.length === 0) {
    return fail("agent instructions", "No AGENTS.md, CLAUDE.md, or .github/copilot-instructions.md file found.");
  }

  return pass("agent instructions", `Found ${existing.join(", ")}.`);
}

async function checkReportsGitignored(root: string): Promise<DoctorCheck> {
  const gitignore = await readText(path.join(root, ".gitignore"));
  if (!gitignore) {
    return fail("reports gitignored", ".gitignore is missing or empty.");
  }

  const ignoresMarkdown = hasGitignoreLine(gitignore, "reports/*.md");
  const ignoresJson = hasGitignoreLine(gitignore, "reports/*.json");
  const keepsGitkeep = hasGitignoreLine(gitignore, "!reports/.gitkeep");
  if (!ignoresMarkdown || !ignoresJson) {
    return fail("reports gitignored", "Generated markdown and JSON reports are not both gitignored.");
  }
  if (!keepsGitkeep) {
    return warn("reports gitignored", "Generated reports are gitignored, but reports/.gitkeep is not explicitly unignored.");
  }

  return pass("reports gitignored", "reports/*.md and reports/*.json are ignored while reports/.gitkeep is preserved.");
}

async function checkFixtureRepo(root: string): Promise<DoctorCheck> {
  const fixtureRoot = path.join(root, "fixture-repos");
  try {
    const entries = await readdir(fixtureRoot, { withFileTypes: true });
    const repos = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const withPackageJson: string[] = [];
    for (const repo of repos) {
      if (await fileExists(path.join(fixtureRoot, repo, "package.json"))) {
        withPackageJson.push(repo);
      }
    }
    if (withPackageJson.length === 0) {
      return fail("fixture repo", "fixture-repos exists but no fixture repository package.json was found.");
    }
    return pass("fixture repo", `Found fixture repo(s): ${withPackageJson.join(", ")}.`);
  } catch {
    return fail("fixture repo", "fixture-repos directory is missing or unreadable.");
  }
}

async function checkProviderSafety(root: string): Promise<DoctorCheck> {
  const cli = await readText(path.join(root, "src", "cli.ts"));
  const openaiProvider = await readText(path.join(root, "src", "providers", "openai.ts"));
  const packageJson = await readJson(path.join(root, "package.json"));
  const scripts = readStringRecord(packageJson?.scripts);
  const scriptsCallProvider = Object.values(scripts).some((script) => /--provider\s+openai/.test(script));

  if (!cli || !openaiProvider) {
    return fail("OpenAI provider safety", "CLI or OpenAI provider source file is missing.");
  }
  if (scriptsCallProvider) {
    return fail("OpenAI provider safety", "A package script invokes --provider openai by default.");
  }
  if (!/--provider openai requires --model <model>/.test(cli) || !/OPENAI_API_KEY is required/.test(openaiProvider)) {
    return fail("OpenAI provider safety", "Provider mode does not clearly require both an explicit model and OPENAI_API_KEY.");
  }

  return pass("OpenAI provider safety", "OpenAI is explicit provider mode only and requires OPENAI_API_KEY.");
}

async function checkAssessment(root: string): Promise<{ check: DoctorCheck; reportPath?: string }> {
  const casePath = path.join(root, "cases", "ghostbench-readiness.json");
  try {
    const assessmentCase = await loadAssessmentCase(casePath);
    const assessment = await assessRepository({
      repoPath: root,
      appBrief: assessmentCase.appBrief,
      briefSource: path.relative(root, casePath),
      expectedAreas: assessmentCase.expectedAreas,
      title: assessmentCase.title,
      id: assessmentCase.id,
      policy: "check",
      reportFormat: "json",
    });
    const failedChecks = assessment.executionChecks.filter((check) => check.status === "failed");
    if (failedChecks.length > 0) {
      return {
        check: fail("assess check policy", `pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check failed: ${failedChecks.map((check) => check.name).join(", ")}.`),
        reportPath: assessment.reportPath,
      };
    }
    return {
      check: pass("assess check policy", `pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check passed with verdict ${assessment.verdict}.`),
      reportPath: assessment.reportPath,
    };
  } catch (error) {
    return {
      check: fail("assess check policy", `pnpm ghostbench assess . --case cases/ghostbench-readiness.json --policy check errored: ${formatError(error)}`),
    };
  }
}

async function readText(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    return content.trim().length > 0 ? content : undefined;
  } catch {
    return undefined;
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown> | undefined> {
  const text = await readText(filePath);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}

async function existingFiles(root: string, candidates: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const candidate of candidates) {
    if (await fileExists(path.join(root, candidate))) {
      existing.push(candidate);
    }
  }
  return existing;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const result = await stat(filePath);
    return result.isFile();
  } catch {
    return false;
  }
}

function hasGitignoreLine(gitignore: string, expected: string): boolean {
  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === expected);
}

function pass(name: string, detail: string): DoctorCheck {
  return { name, status: "pass", detail };
}

function warn(name: string, detail: string): DoctorCheck {
  return { name, status: "warn", detail };
}

function fail(name: string, detail: string): DoctorCheck {
  return { name, status: "fail", detail };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
