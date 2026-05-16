import { access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { loadRepoContext } from "./loadRepoContext.js";
import type {
  AssessmentCase,
  DimensionScore,
  ExecutionCheck,
  ExecutionPolicy,
  FrameworkSignal,
  ReadinessAssessment,
  ReadinessDimensionId,
  ReadinessVerdict,
  RepoContext,
  ScriptInventory,
} from "./types.js";
import { writeReadinessReport } from "./report.js";

const execFileAsync = promisify(execFile);
const CHECK_TIMEOUT_MS = 30_000;

const DIMENSIONS: { id: ReadinessDimensionId; name: string }[] = [
  { id: "product-coherence", name: "Product Coherence" },
  { id: "runtime-health", name: "Runtime Health" },
  { id: "ux-completeness", name: "UX Completeness" },
  { id: "maintainability", name: "Maintainability" },
  { id: "safety", name: "Safety" },
  { id: "agent-readiness", name: "Agent Readiness" },
];

export interface AssessOptions {
  repoPath: string;
  appBrief: string;
  briefSource: string;
  expectedAreas?: string[];
  title?: string;
  id?: string;
  policy?: ExecutionPolicy;
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
  const score = round2(dimensions.reduce((total, dimension) => total + dimension.score, 0) / DIMENSIONS.length);
  const concerns = unique(dimensions.flatMap((dimension) => dimension.concerns));
  const evidence = unique(dimensions.flatMap((dimension) => dimension.evidence));
  const blockingConcerns = findBlockingConcerns(repoContext, scriptInventory, executionChecks, concerns, options.appBrief);
  const verdict = readinessVerdict(score, blockingConcerns, warnings, repoContext.exists);
  const remediationGuidance = buildRemediationGuidance(dimensions, blockingConcerns, executionChecks, scriptInventory);

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

function readScriptInventory(repoContext: RepoContext): ScriptInventory {
  const packageJson = repoContext.files.find((file) => file.path === "package.json");
  const warnings: string[] = [];
  if (!packageJson) {
    return {
      packageManager: "unknown",
      scripts: {},
      dependencies: [],
      devDependencies: [],
      warnings: ["No package.json was found in the scanned repo context."],
    };
  }

  try {
    const parsed = JSON.parse(packageJson.content) as {
      scripts?: Record<string, unknown>;
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
      packageManager?: unknown;
    };
    return {
      packageManager: detectPackageManager(parsed.packageManager, repoContext),
      scripts: readStringRecord(parsed.scripts),
      dependencies: Object.keys(readStringRecord(parsed.dependencies)),
      devDependencies: Object.keys(readStringRecord(parsed.devDependencies)),
      warnings,
    };
  } catch {
    return {
      packageManager: "unknown",
      scripts: {},
      dependencies: [],
      devDependencies: [],
      warnings: ["package.json could not be parsed."],
    };
  }
}

function detectFrameworkSignals(repoContext: RepoContext, inventory: ScriptInventory): FrameworkSignal[] {
  const files = new Set(repoContext.files.map((file) => file.path));
  const deps = new Set([...inventory.dependencies, ...inventory.devDependencies]);
  const signals: FrameworkSignal[] = [];

  if (deps.has("next") || files.has("next.config.js") || files.has("next.config.mjs") || hasPathPrefix(files, "app/")) {
    signals.push({ name: "Next.js", evidence: "Next.js dependency, config, or app directory detected." });
  }
  if (deps.has("vite") || files.has("vite.config.ts") || files.has("vite.config.js")) {
    signals.push({ name: "Vite", evidence: "Vite dependency or config detected." });
  }
  if (deps.has("react") || deps.has("react-dom")) {
    signals.push({ name: "React", evidence: "React dependencies detected." });
  }
  if (deps.has("typescript") || files.has("tsconfig.json")) {
    signals.push({ name: "TypeScript", evidence: "TypeScript dependency or tsconfig detected." });
  }
  if (deps.has("expo") || files.has("app.json")) {
    signals.push({ name: "Expo", evidence: "Expo dependency or app config detected." });
  }
  if (files.has("tailwind.config.ts") || files.has("tailwind.config.js") || deps.has("tailwindcss")) {
    signals.push({ name: "Tailwind CSS", evidence: "Tailwind dependency or config detected." });
  }

  return signals;
}

async function runExecutionChecks(
  repoPath: string,
  policy: ExecutionPolicy,
  inventory: ScriptInventory,
): Promise<ExecutionCheck[]> {
  if (policy === "inspect") {
    return [{ name: "execution policy", command: "none", status: "skipped", output: "Inspect policy does not run repository commands." }];
  }
  if (policy === "sandboxed" || policy === "trusted") {
    return [
      {
        name: "execution policy",
        command: "none",
        status: "skipped",
        output: `${policy} policy is defined but not implemented in the MVP slice; use check for dependency-present checks.`,
      },
    ];
  }

  const nodeModulesPath = path.join(repoPath, "node_modules");
  try {
    await access(nodeModulesPath);
  } catch {
    return [
      {
        name: "dependency check",
        command: "none",
        status: "skipped",
        output: "Check policy requires existing node_modules; install was not run.",
      },
    ];
  }

  const checks: ExecutionCheck[] = [];
  for (const scriptName of ["typecheck", "build", "test"]) {
    if (!inventory.scripts[scriptName]) {
      checks.push({
        name: scriptName,
        command: "none",
        status: "skipped",
        output: `No ${scriptName} script declared in package.json.`,
      });
      continue;
    }
    checks.push(await runPackageScript(repoPath, inventory.packageManager, scriptName));
  }
  return checks;
}

async function runPackageScript(
  repoPath: string,
  packageManager: ScriptInventory["packageManager"],
  scriptName: string,
): Promise<ExecutionCheck> {
  const command = packageManager === "npm" || packageManager === "unknown" ? "npm" : packageManager;
  const args = command === "npm" ? ["run", scriptName, "--if-present"] : ["run", scriptName];
  const commandText = `${command} ${args.join(" ")}`;
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoPath,
      timeout: CHECK_TIMEOUT_MS,
      maxBuffer: 64 * 1024,
    });
    return {
      name: scriptName,
      command: commandText,
      status: "passed",
      output: truncateOutput(`${result.stdout}\n${result.stderr}`.trim()),
    };
  } catch (error) {
    return {
      name: scriptName,
      command: commandText,
      status: "failed",
      output: truncateOutput(formatExecError(error)),
    };
  }
}

function scoreDimensions(input: {
  repoContext: RepoContext;
  scriptInventory: ScriptInventory;
  frameworkSignals: FrameworkSignal[];
  executionChecks: ExecutionCheck[];
  appBrief: string;
  expectedAreas: string[];
}): DimensionScore[] {
  return DIMENSIONS.map((dimension) => scoreDimension(dimension.id, dimension.name, input));
}

function scoreDimension(
  id: ReadinessDimensionId,
  name: string,
  input: {
    repoContext: RepoContext;
    scriptInventory: ScriptInventory;
    frameworkSignals: FrameworkSignal[];
    executionChecks: ExecutionCheck[];
    appBrief: string;
    expectedAreas: string[];
  },
): DimensionScore {
  const evidence: string[] = [];
  const concerns: string[] = [];
  let score = 4;
  const files = input.repoContext.files;
  const filePaths = files.map((file) => file.path);
  const combinedText = files.map((file) => `${file.path}\n${file.content}`).join("\n").toLowerCase();
  const briefKeywords = extractKeywords(input.appBrief);
  const briefHits = briefKeywords.filter((keyword) => combinedText.includes(keyword));
  const expectedHits = input.expectedAreas.filter((area) => areaMatches(area, filePaths, combinedText));
  const passedChecks = input.executionChecks.filter((check) => check.status === "passed");
  const failedChecks = input.executionChecks.filter((check) => check.status === "failed");

  if (!input.repoContext.exists) {
    concerns.push("Repository path was unavailable.");
    return { id, name, score: 0, maxScore: 10, evidence, concerns };
  }

  if (id === "product-coherence") {
    score += Math.min(2.5, briefHits.length * 0.5);
    score += Math.min(2, expectedHits.length * 1);
    if (hasAnyFile(filePaths, ["README.md", "readme"])) {
      score += 1;
      evidence.push("Repository includes a README that may explain product intent.");
    }
    if (briefHits.length > 0) {
      evidence.push(`Repository content matches app brief language: ${briefHits.slice(0, 6).join(", ")}.`);
    } else {
      concerns.push("Repository content has little obvious overlap with the supplied app brief.");
    }
    if (expectedHits.length > 0) {
      evidence.push(`Expected areas appear in repository context: ${expectedHits.slice(0, 6).join(", ")}.`);
    }
  }

  if (id === "runtime-health") {
    score += Math.min(2, Object.keys(input.scriptInventory.scripts).length * 0.4);
    score += Math.min(3, passedChecks.length * 1.5);
    score -= Math.min(4, failedChecks.length * 2);
    if (Object.keys(input.scriptInventory.scripts).length > 0) {
      evidence.push(`Declared package scripts: ${Object.keys(input.scriptInventory.scripts).join(", ")}.`);
    } else {
      concerns.push("No package scripts were found for local health checks.");
    }
    for (const check of passedChecks) {
      evidence.push(`${check.command} passed.`);
    }
    for (const check of failedChecks) {
      concerns.push(`${check.command} failed.`);
    }
    if (input.executionChecks.every((check) => check.status === "skipped")) {
      concerns.push("No execution checks ran under the selected policy.");
    }
  }

  if (id === "ux-completeness") {
    const uiFiles = filePaths.filter((filePath) => /\.(tsx|jsx|html|css)$/.test(filePath));
    const stateHits = countTextHits(combinedText, ["loading", "empty", "error", "not found", "disabled", "aria-", "responsive"]);
    score += Math.min(2, uiFiles.length * 0.3);
    score += Math.min(2, stateHits * 0.5);
    if (uiFiles.length > 0) {
      evidence.push(`UI-facing files are present: ${uiFiles.slice(0, 6).join(", ")}.`);
    } else {
      concerns.push("No UI-facing files were found in the scanned context.");
    }
    if (stateHits > 0) {
      evidence.push("Repository includes user-state language such as loading, empty, error, accessibility, or responsive handling.");
    } else {
      concerns.push("No obvious loading, empty, error, accessibility, or responsive-state handling was found.");
    }
  }

  if (id === "maintainability") {
    const srcCount = filePaths.filter((filePath) => filePath.startsWith("src/") || filePath.startsWith("app/")).length;
    const configCount = filePaths.filter((filePath) => /^(package\.json|tsconfig\.json|vite\.config|next\.config|eslint|biome|prettier)/.test(filePath)).length;
    const oversizedFiles = files.filter((file) => file.truncated);
    score += Math.min(2, srcCount * 0.25);
    score += Math.min(2, configCount * 0.7);
    score -= Math.min(2, oversizedFiles.length);
    if (srcCount > 0) {
      evidence.push(`Application source files are organized under src/app-style areas (${srcCount} scanned files).`);
    } else {
      concerns.push("No conventional application source directory was found in the scanned context.");
    }
    if (configCount > 0) {
      evidence.push("Project configuration files are present.");
    }
    if (oversizedFiles.length > 0) {
      concerns.push(`Large files required truncation: ${oversizedFiles.map((file) => file.path).slice(0, 4).join(", ")}.`);
    }
  }

  if (id === "safety") {
    score += 2;
    const secretFindings = findSecretFindings(files);
    if (secretFindings.committed.length === 0 && secretFindings.placeholders.length === 0) {
      evidence.push("No obvious committed secret files or secret-looking values were found in scanned files.");
    } else {
      if (secretFindings.committed.length > 0) {
        score -= Math.min(5, secretFindings.committed.length * 2);
        concerns.push(
          `Potential committed secret material was found in scanned files: ${secretFindings.committed.slice(0, 4).join(", ")}.`,
        );
      }
      if (secretFindings.placeholders.length > 0) {
        score -= Math.min(1.5, secretFindings.placeholders.length * 0.25);
        concerns.push(
          `Secret placeholders were found in template or example files: ${secretFindings.placeholders.slice(0, 4).join(", ")}.`,
        );
      }
    }
    if (input.scriptInventory.dependencies.length + input.scriptInventory.devDependencies.length > 0) {
      evidence.push("Dependencies are declared in package.json for review.");
    }
  }

  if (id === "agent-readiness") {
    const docFiles = filePaths.filter((filePath) => /(^README|AGENTS\.md|CONTEXT\.md|docs\/)/i.test(filePath));
    const typed = input.frameworkSignals.some((signal) => signal.name === "TypeScript");
    score += Math.min(3, docFiles.length);
    if (typed) {
      score += 1;
      evidence.push("TypeScript signals can help future agents understand contracts.");
    }
    if (docFiles.length > 0) {
      evidence.push(`Agent-readable documentation exists: ${docFiles.slice(0, 6).join(", ")}.`);
    } else {
      concerns.push("No README, AGENTS, CONTEXT, or docs files were found for future agent orientation.");
    }
  }

  if (input.frameworkSignals.length > 0) {
    evidence.push(`Framework signals: ${input.frameworkSignals.map((signal) => signal.name).join(", ")}.`);
  }

  return {
    id,
    name,
    score: clamp(round2(score), 0, 10),
    maxScore: 10,
    evidence: unique(evidence),
    concerns: unique(concerns),
  };
}

function findBlockingConcerns(
  repoContext: RepoContext,
  inventory: ScriptInventory,
  executionChecks: ExecutionCheck[],
  concerns: string[],
  appBrief: string,
): string[] {
  const blocking: string[] = [];
  if (!repoContext.exists) {
    blocking.push("Repository path is unavailable.");
  }
  for (const check of executionChecks.filter((item) => item.status === "failed")) {
    blocking.push(`${check.command} failed.`);
  }
  if (appBrief.trim().length === 0) {
    blocking.push("No app brief was available to validate product coherence.");
  }
  if (Object.keys(inventory.scripts).length === 0) {
    blocking.push("No package scripts are available to validate runtime health.");
  }
  if (concerns.some((concern) => concern.includes("Potential committed secret material was found"))) {
    blocking.push("Potential committed secret material requires review before readiness can be trusted.");
  }
  return unique(blocking);
}

function readinessVerdict(
  score: number,
  blockingConcerns: string[],
  warnings: string[],
  repoExists: boolean,
): ReadinessVerdict {
  if (!repoExists || warnings.some((warning) => warning.includes("No explicit app brief"))) {
    return "unknown";
  }
  if (blockingConcerns.length > 0 || score < 5) {
    return "not-ready";
  }
  if (score >= 8) {
    return "ready";
  }
  return "conditionally-ready";
}

function buildRemediationGuidance(
  dimensions: DimensionScore[],
  blockingConcerns: string[],
  executionChecks: ExecutionCheck[],
  inventory: ScriptInventory,
): string[] {
  const guidance: string[] = [];
  for (const concern of blockingConcerns) {
    guidance.push(`Resolve blocking concern: ${concern}`);
  }
  for (const check of executionChecks.filter((item) => item.status === "failed")) {
    guidance.push(`Fix the failing ${check.name} check before relying on the repository readiness score.`);
  }
  if (!inventory.scripts.typecheck) {
    guidance.push("Add a typecheck script so Ghostbench and future agents can verify code health consistently.");
  }
  if (!inventory.scripts.build) {
    guidance.push("Add a build script that validates the app can be packaged or compiled locally.");
  }
  for (const dimension of [...dimensions].sort((a, b) => a.score - b.score).slice(0, 3)) {
    if (dimension.concerns[0]) {
      guidance.push(`Improve ${dimension.name}: ${dimension.concerns[0]}`);
    }
  }
  return unique(guidance).slice(0, 10);
}

function detectPackageManager(value: unknown, repoContext: RepoContext): ScriptInventory["packageManager"] {
  if (typeof value === "string") {
    if (value.startsWith("pnpm")) return "pnpm";
    if (value.startsWith("yarn")) return "yarn";
    if (value.startsWith("npm")) return "npm";
  }
  const files = new Set(repoContext.files.map((file) => file.path));
  if (files.has("pnpm-lock.yaml")) return "pnpm";
  if (files.has("yarn.lock")) return "yarn";
  if (files.has("package-lock.json")) return "npm";
  return "npm";
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

function extractKeywords(text: string): string[] {
  const stopwords = new Set(["a", "an", "and", "app", "are", "as", "for", "in", "is", "of", "or", "the", "to", "with"]);
  return unique(
    text
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g)
      ?.filter((word) => !stopwords.has(word)) ?? [],
  ).slice(0, 30);
}

function areaMatches(area: string, filePaths: string[], combinedText: string): boolean {
  const normalized = area.toLowerCase().replace(/^\.\//, "");
  return filePaths.some((filePath) => filePath.toLowerCase().includes(normalized)) || combinedText.includes(normalized);
}

function hasPathPrefix(files: Set<string>, prefix: string): boolean {
  return [...files].some((file) => file.startsWith(prefix));
}

function hasAnyFile(filePaths: string[], names: string[]): boolean {
  return filePaths.some((filePath) => names.some((name) => filePath.toLowerCase() === name.toLowerCase()));
}

function countTextHits(text: string, needles: string[]): number {
  return needles.filter((needle) => text.includes(needle)).length;
}

function findSecretFindings(files: RepoContext["files"]): { committed: string[]; placeholders: string[] } {
  const committed: string[] = [];
  const placeholders: string[] = [];

  for (const file of files) {
    if (!isSecretRelevantFile(file.path)) {
      continue;
    }

    for (const [index, line] of file.content.split(/\r?\n/).entries()) {
      const parsed = parseAssignment(line);
      if (!parsed || !isSecretLikeKey(parsed.key, parsed.value)) {
        continue;
      }

      const finding = `${file.path}:${index + 1} ${parsed.key}`;
      if (isTemplateFile(file.path) || isPlaceholderValue(parsed.value)) {
        placeholders.push(finding);
      } else {
        committed.push(finding);
      }
    }
  }

  return {
    committed: unique(committed),
    placeholders: unique(placeholders),
  };
}

function isSecretRelevantFile(filePath: string): boolean {
  return (
    /^\.env($|\.)/i.test(filePath) ||
    /(^|\/)(env\.template|.*\.example|.*\.sample)$/i.test(filePath) ||
    /\.(ts|tsx|js|jsx|json|md|yaml|yml)$/i.test(filePath)
  );
}

function isTemplateFile(filePath: string): boolean {
  return /(^|\/)(env\.template|.*\.example|.*\.sample|README\.md)$/i.test(filePath);
}

function parseAssignment(line: string): { key: string; value: string } | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  const match = trimmed.match(/^(?:export\s+)?([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PRIVATE)[A-Z0-9_]*)\s*[:=]\s*["']?([^"',\s#]+)["']?/);
  if (!match) {
    return undefined;
  }

  return {
    key: match[1],
    value: match[2],
  };
}

function isSecretLikeKey(key: string, value: string): boolean {
  if (/^(NEXT_PUBLIC_|PUBLIC_)/i.test(key)) {
    return false;
  }
  return /(KEY|SECRET|TOKEN|PASSWORD|PRIVATE)/i.test(key) || /^sk-[A-Za-z0-9_-]{12,}/.test(value);
}

function isPlaceholderValue(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  if (
    normalized.includes("your-") ||
    normalized.includes("change-this") ||
    normalized.includes("placeholder") ||
    normalized.includes("example") ||
    normalized.includes("dummy") ||
    normalized.includes("fake") ||
    normalized.includes("for-build") ||
    normalized.includes("testing-only") ||
    normalized.includes("test") ||
    normalized.includes("todo") ||
    normalized.includes("<") ||
    normalized.includes("...")
  ) {
    return true;
  }
  return /^(xxx+|changeme|replace_me|replace-me|sample|none|null)$/i.test(value);
}

function truncateOutput(value: string): string {
  return value.length > 2_000 ? `${value.slice(0, 2_000)}...` : value;
}

function formatExecError(error: unknown): string {
  if (error && typeof error === "object") {
    const maybe = error as { stdout?: string; stderr?: string; message?: string };
    return `${maybe.stdout ?? ""}\n${maybe.stderr ?? ""}\n${maybe.message ?? ""}`.trim();
  }
  return String(error);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "assessment";
}
