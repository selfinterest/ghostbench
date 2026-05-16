import path from "node:path";
import type { AgentResponse, EvalCase, Judgment, RepoContext, RubricItem, RubricScore, Verdict } from "./types.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "when",
  "with",
]);

const EDGE_CASE_WORDS = [
  "overflow",
  "resize",
  "resizing",
  "missing",
  "fallback",
  "empty",
  "large",
  "small",
  "deterministic",
  "version",
  "versions",
  "cache",
  "cached",
  "stable",
];

const UNCERTAINTY_WORDS = ["likely", "probably", "maybe", "verify", "confirm", "inspect", "unclear", "if"];
const OVERBROAD_PATTERNS = [/rewrite from scratch/i, /complete rewrite/i, /full rewrite/i, /overhaul/i, /replace the architecture/i];
const GENERIC_PLAN_PATTERNS = [/inspect the code/i, /understand the codebase/i, /write tests/i, /update documentation/i];

export function judgeResponses(evalCase: EvalCase, repoContext: RepoContext, responses: AgentResponse[]): Judgment[] {
  return responses.map((response) => judgeResponse(evalCase, repoContext, response));
}

function judgeResponse(evalCase: EvalCase, repoContext: RepoContext, response: AgentResponse): Judgment {
  const text = response.text;
  const lowerText = text.toLowerCase();
  const repoPaths = new Set(repoContext.files.map((file) => file.path));
  const repoSearchText = repoContext.files
    .map((file) => `${file.path}\n${file.content}`)
    .join("\n")
    .toLowerCase();

  const mentionedPaths = extractPaths(text);
  const mentionedSymbols = extractSymbols(text, mentionedPaths);
  const existingPathHits = mentionedPaths.filter((filePath) => repoPaths.has(filePath));
  const inventedPaths = mentionedPaths.filter((filePath) => !repoPaths.has(filePath));
  const inventedSymbols = mentionedSymbols.filter((symbol) => !repoSearchText.includes(symbol.toLowerCase()));
  const expectedHits = evalCase.expectedFiles.filter((expected) => matchesExpected(expected, mentionedPaths, repoContext));
  const keywords = extractKeywords([evalCase.task, ...evalCase.rubric.map((item) => item.description)]);
  const keywordHits = keywords.filter((keyword) => lowerText.includes(keyword));
  const edgeHits = EDGE_CASE_WORDS.filter((word) => lowerText.includes(word));
  const boundedSignals = countMatches(lowerText, ["bounded", "incremental", "small", "focused", "limited", "avoid", "scope"]);
  const specificInspection = /\binspect\b|\bverify\b|\bconfirm\b/i.test(text) && (mentionedPaths.length > 0 || mentionedSymbols.length > 0);
  const genericPlanHits = GENERIC_PLAN_PATTERNS.filter((pattern) => pattern.test(text));
  const overbroadHits = OVERBROAD_PATTERNS.filter((pattern) => pattern.test(text));
  const vectorDbPrimary =
    /vector (database|db)|embeddings?|semantic search|rag system/i.test(text) && !hasNearbyAvoidance(text, "vector");
  const deterministicCase = /deterministic|diff|artifact|stable identifier|version/i.test(
    `${evalCase.task} ${evalCase.rubric.map((item) => item.description).join(" ")}`,
  );

  const evidence = new Set<string>();
  const concerns = new Set<string>();

  if (existingPathHits.length > 0) {
    evidence.add(`References files found in available repo context: ${existingPathHits.slice(0, 5).join(", ")}.`);
  }
  if (expectedHits.length > 0) {
    evidence.add(`Matches expected files or areas: ${expectedHits.slice(0, 5).join(", ")}.`);
  }
  if (specificInspection) {
    evidence.add("Uses a specific inspection or verification plan instead of a generic next step.");
  }
  if (boundedSignals > 0) {
    evidence.add("Describes a bounded or incremental approach.");
  }
  if (edgeHits.length > 0) {
    evidence.add(`Mentions relevant edge-case language: ${edgeHits.slice(0, 6).join(", ")}.`);
  }

  for (const inventedPath of inventedPaths.slice(0, 8)) {
    const cautious = hasNearbyUncertainty(text, inventedPath);
    concerns.add(
      `${inventedPath} is not found in available repo context${cautious ? ", though the response phrases it cautiously" : ""}.`,
    );
  }
  for (const symbol of inventedSymbols.slice(0, 8)) {
    const cautious = hasNearbyUncertainty(text, symbol);
    concerns.add(
      `${symbol} is not found in available repo context${cautious ? ", though the response phrases it cautiously" : ""}.`,
    );
  }
  if (overbroadHits.length > 0) {
    concerns.add("Uses overbroad rewrite language that exceeds the task scope.");
  }
  if (genericPlanHits.length >= 2 && existingPathHits.length === 0 && expectedHits.length === 0) {
    concerns.add("Relies on a generic plan without enough task-specific or repo-specific evidence.");
  }
  if (vectorDbPrimary && deterministicCase) {
    concerns.add("Centers vector database or generic RAG architecture where the case emphasizes deterministic comparison.");
  }
  if (!repoContext.exists && inventedPaths.length > 0) {
    concerns.add("Names repo-specific files even though the target repository was unavailable.");
  }
  if (/tests? (already )?(cover|prove|pass)/i.test(text) && !repoContext.files.some((file) => /test|spec/i.test(file.path))) {
    concerns.add("Makes a confident test-coverage claim without test files in available repo context.");
  }

  const rubricScores = evalCase.rubric.map((item) =>
    scoreRubricItem(item, {
      lowerText,
      keywords,
      keywordHits,
      expectedHits,
      existingPathHits,
      inventedPaths,
      inventedSymbols,
      edgeHits,
      boundedSignals,
      overbroadHits,
      genericPlanHits,
      vectorDbPrimary,
      deterministicCase,
      repoExists: repoContext.exists,
    }),
  );

  const rawScore = sum(rubricScores.map((score) => score.rawScore));
  const maxScore = rubricScores.length * 10;
  const totalWeight = sum(evalCase.rubric.map((item) => item.weight));
  const weightedScore = round2(sum(rubricScores.map((score) => score.weightedScore)) / totalWeight);
  const verdict = verdictFor(weightedScore);

  if (evidence.size === 0) {
    concerns.add("Provides little repo-grounded evidence for the proposed approach.");
  }

  return {
    responseName: response.name,
    responseSourceType: response.sourceType,
    responseSource:
      response.sourceType === "fixture" ? path.relative(process.cwd(), response.source) : response.source,
    rubricScores,
    rawScore: round2(rawScore),
    maxScore,
    weightedScore,
    verdict,
    evidence: [...evidence],
    concerns: [...concerns],
  };
}

interface ScoreInputs {
  lowerText: string;
  keywords: string[];
  keywordHits: string[];
  expectedHits: string[];
  existingPathHits: string[];
  inventedPaths: string[];
  inventedSymbols: string[];
  edgeHits: string[];
  boundedSignals: number;
  overbroadHits: RegExp[];
  genericPlanHits: RegExp[];
  vectorDbPrimary: boolean;
  deterministicCase: boolean;
  repoExists: boolean;
}

function scoreRubricItem(item: RubricItem, inputs: ScoreInputs): RubricScore {
  const rubricKeywords = extractKeywords([item.description]);
  const rubricHits = rubricKeywords.filter((keyword) => inputs.lowerText.includes(keyword));

  let score = 2;
  score += Math.min(2.5, inputs.existingPathHits.length * 1.2);
  score += Math.min(2, inputs.expectedHits.length * 1.5);
  score += Math.min(1.5, rubricHits.length * 0.45);
  score += Math.min(1, inputs.keywordHits.length / Math.max(inputs.keywords.length, 1) * 2);
  score += Math.min(1, inputs.edgeHits.length * 0.3);
  score += Math.min(1, inputs.boundedSignals * 0.4);

  if (/edge|overflow|resize|missing|deterministic|version|cache|stable/i.test(item.description)) {
    score += Math.min(2, inputs.edgeHits.length * 0.6);
  }
  if (/file|function|layout|artifact|repo|identifier|comparison/i.test(item.description)) {
    score += Math.min(2, (inputs.existingPathHits.length + inputs.expectedHits.length) * 0.7);
  }

  const confidentInventedPaths = inputs.inventedPaths.filter((filePath) => !hasNearbyUncertainty(inputs.lowerText, filePath));
  const confidentInventedSymbols = inputs.inventedSymbols.filter((symbol) => !hasNearbyUncertainty(inputs.lowerText, symbol));
  score -= Math.min(3, confidentInventedPaths.length * 0.8);
  score -= Math.min(2, confidentInventedSymbols.length * 0.5);
  score -= Math.min(2, inputs.overbroadHits.length * 1.5);
  if (inputs.genericPlanHits.length >= 2 && inputs.existingPathHits.length === 0) {
    score -= 1.5;
  }
  if (inputs.vectorDbPrimary && inputs.deterministicCase) {
    score -= 3;
  }
  if (!inputs.repoExists && confidentInventedPaths.length > 0) {
    score -= 1;
  }

  const rawScore = clamp(round2(score), 0, 10);
  return {
    rubricItemId: item.id,
    description: item.description,
    rawScore,
    maxScore: 10,
    weight: item.weight,
    weightedScore: round2(rawScore * item.weight),
  };
}

function extractPaths(text: string): string[] {
  const matches = text.match(/(?:[\w.-]+\/)+[\w.@-]+\.[A-Za-z0-9]+|(?:[\w.-]+\/)+[\w.@-]+/g) ?? [];
  return unique(
    matches
      .map((match) => match.replace(/[),.;:'"`]+$/g, ""))
      .filter((match) => !match.startsWith("http"))
      .filter((match) => isLikelyRepoPath(match))
      .map((match) => match.replace(/^\.\//, "")),
  );
}

function isLikelyRepoPath(value: string): boolean {
  if (/\.[A-Za-z0-9]+$/.test(value)) {
    return true;
  }
  if (value.startsWith("./") || value.startsWith("../")) {
    return true;
  }
  if (value.split("/").length >= 3) {
    return true;
  }
  return /^(src|lib|app|apps|packages|docs|test|tests|fixtures|cases|components|layouts|templates)\//i.test(value);
}

function extractSymbols(text: string, paths: string[]): string[] {
  const pathParts = new Set(paths.flatMap((filePath) => filePath.split(/[/.]/g)));
  const backticked = [...text.matchAll(/`([A-Za-z_$][\w$]*(?:\(\))?)`/g)].map((match) => match[1]);
  const functions = [...text.matchAll(/\b([A-Za-z_$][\w$]{2,})\(\)/g)].map((match) => match[1]);
  return unique([...backticked, ...functions])
    .map((symbol) => symbol.replace(/\(\)$/, ""))
    .filter((symbol) => !pathParts.has(symbol))
    .filter((symbol) => !STOPWORDS.has(symbol.toLowerCase()));
}

function extractKeywords(parts: string[]): string[] {
  return unique(
    parts
      .join(" ")
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{2,}/g) ?? [],
  ).filter((word) => !STOPWORDS.has(word));
}

function matchesExpected(expected: string, mentionedPaths: string[], repoContext: RepoContext): boolean {
  const normalized = expected.replace(/^\.\//, "").replace(/\/$/, "");
  return (
    mentionedPaths.some((filePath) => filePath === normalized || filePath.startsWith(`${normalized}/`)) ||
    repoContext.files.some((file) => file.path === normalized || file.path.startsWith(`${normalized}/`))
  );
}

function hasNearbyUncertainty(text: string, needle: string): boolean {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(needle.toLowerCase());
  if (index < 0) {
    return false;
  }
  const window = lowerText.slice(Math.max(0, index - 80), Math.min(lowerText.length, index + needle.length + 80));
  return UNCERTAINTY_WORDS.some((word) => window.includes(word));
}

function hasNearbyAvoidance(text: string, needle: string): boolean {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(needle.toLowerCase());
  if (index < 0) {
    return false;
  }
  const window = lowerText.slice(Math.max(0, index - 100), Math.min(lowerText.length, index + 120));
  return /\b(avoid|unless|not|rather than|instead of|without)\b/.test(window);
}

function countMatches(text: string, words: string[]): number {
  return words.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
}

function verdictFor(weightedScore: number): Verdict {
  if (weightedScore >= 7.5) {
    return "strong";
  }
  if (weightedScore >= 5) {
    return "acceptable";
  }
  return "weak";
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function sum(numbers: number[]): number {
  return numbers.reduce((total, value) => total + value, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
