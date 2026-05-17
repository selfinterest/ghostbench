import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ExecutionCheck, ExecutionPolicy, FrameworkSignal, RepoContext, ScriptInventory } from "./types.js";

const execFileAsync = promisify(execFile);
const CHECK_TIMEOUT_MS = 30_000;

export function readScriptInventory(repoContext: RepoContext): ScriptInventory {
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

export function detectFrameworkSignals(repoContext: RepoContext, inventory: ScriptInventory): FrameworkSignal[] {
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

export async function runExecutionChecks(
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

function hasPathPrefix(files: Set<string>, prefix: string): boolean {
  return [...files].some((file) => file.startsWith(prefix));
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
