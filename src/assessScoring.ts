import type {
  DimensionScore,
  ExecutionCheck,
  FrameworkSignal,
  ReadinessDimensionId,
  ReadinessVerdict,
  RepoContext,
  ScriptInventory,
} from "./types.js";

const DIMENSIONS: { id: ReadinessDimensionId; name: string }[] = [
  { id: "product-coherence", name: "Product Coherence" },
  { id: "runtime-health", name: "Runtime Health" },
  { id: "ux-completeness", name: "UX Completeness" },
  { id: "maintainability", name: "Maintainability" },
  { id: "safety", name: "Safety" },
  { id: "agent-readiness", name: "Agent Readiness" },
];

export interface DimensionInput {
  repoContext: RepoContext;
  scriptInventory: ScriptInventory;
  frameworkSignals: FrameworkSignal[];
  executionChecks: ExecutionCheck[];
  appBrief: string;
  expectedAreas: string[];
}

export function scoreDimensions(input: DimensionInput): DimensionScore[] {
  return DIMENSIONS.map((dimension) => scoreDimension(dimension.id, dimension.name, input));
}

export function averageDimensionScore(dimensions: DimensionScore[]): number {
  return round2(dimensions.reduce((total, dimension) => total + dimension.score, 0) / DIMENSIONS.length);
}

export function findBlockingConcerns(
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

export function readinessVerdict(
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

export function buildRemediationGuidance(
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

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function scoreDimension(id: ReadinessDimensionId, name: string, input: DimensionInput): DimensionScore {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
