export interface EvalCase {
  id: string;
  title: string;
  repoSource: RepoSource;
  task: string;
  expectedFiles: string[];
  ignoreGlobs: string[];
  rubric: RubricItem[];
  responses: CaseResponse[];
  casePath: string;
  caseDir: string;
}

export type RepoSource = LocalRepoSource | GitHubRepoSource;

export interface LocalRepoSource {
  type: "local";
  path: string;
}

export interface GitHubRepoSource {
  type: "github";
  url: string;
  ref?: string;
}

export interface CaseResponse {
  name: string;
  fixturePath: string;
  resolvedFixturePath: string;
}

export interface RubricItem {
  id: string;
  description: string;
  weight: number;
}

export interface RepoContext {
  repoPath: string;
  repoSource: string;
  exists: boolean;
  ignoreGlobs: string[];
  files: RepoFile[];
  warnings: string[];
  totalEligibleFiles: number;
  scannedFiles: number;
}

export interface RepoFile {
  path: string;
  extension: string;
  content: string;
  truncated: boolean;
}

export interface AgentResponse {
  name: string;
  sourceType: "fixture" | "provider";
  source: string;
  text: string;
}

export interface RubricScore {
  rubricItemId: string;
  description: string;
  rawScore: number;
  maxScore: number;
  weight: number;
  weightedScore: number;
}

export type Verdict = "strong" | "acceptable" | "weak";

export interface Judgment {
  responseName: string;
  responseSourceType: "fixture" | "provider";
  responseSource: string;
  rubricScores: RubricScore[];
  rawScore: number;
  maxScore: number;
  weightedScore: number;
  verdict: Verdict;
  evidence: string[];
  concerns: string[];
}

export interface RunResult {
  case: EvalCase;
  repoContext: RepoContext;
  responses: AgentResponse[];
  judgments: Judgment[];
  ranking: Judgment[];
  warnings: string[];
  reportPath: string;
}

export type ExecutionPolicy = "inspect" | "check" | "sandboxed" | "trusted";

export type ReportFormat = "markdown" | "json";

export type ReadinessDimensionId =
  | "product-coherence"
  | "runtime-health"
  | "ux-completeness"
  | "maintainability"
  | "safety"
  | "agent-readiness";

export type ReadinessVerdict = "ready" | "conditionally-ready" | "not-ready" | "unknown";

export interface AssessmentCase {
  id: string;
  title: string;
  appBrief: string;
  repoSource?: RepoSource;
  expectedAreas: string[];
  ignoreGlobs: string[];
  casePath: string;
  caseDir: string;
}

export interface FrameworkSignal {
  name: string;
  evidence: string;
}

export interface ScriptInventory {
  packageManager: "pnpm" | "npm" | "yarn" | "unknown";
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  warnings: string[];
}

export interface ExecutionCheck {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  output: string;
}

export interface DimensionScore {
  id: ReadinessDimensionId;
  name: string;
  score: number;
  maxScore: number;
  evidence: string[];
  concerns: string[];
}

export interface ReadinessAssessment {
  id: string;
  title: string;
  repoPath: string;
  appBrief: string;
  briefSource: string;
  executionPolicy: ExecutionPolicy;
  repoContext: RepoContext;
  expectedAreas: string[];
  frameworkSignals: FrameworkSignal[];
  scriptInventory: ScriptInventory;
  executionChecks: ExecutionCheck[];
  dimensions: DimensionScore[];
  score: number;
  verdict: ReadinessVerdict;
  evidence: string[];
  concerns: string[];
  blockingConcerns: string[];
  remediationGuidance: string[];
  providerReview?: ProviderReadinessReview;
  warnings: string[];
  reportPath: string;
}

export type ReadinessRegressionStatus = "improved" | "regressed" | "unchanged";

export interface ConcernDelta {
  id: string;
  text: string;
}

export interface DimensionDelta {
  id: ReadinessDimensionId;
  name: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  evidence: string[];
  concerns: string[];
}

export interface ReadinessRegression {
  status: ReadinessRegressionStatus;
  previousScore: number;
  currentScore: number;
  delta: number;
  previousVerdict: ReadinessVerdict;
  currentVerdict: ReadinessVerdict;
  newBlockingConcerns: ConcernDelta[];
  newConcerns: ConcernDelta[];
  resolvedBlockingConcerns: ConcernDelta[];
  resolvedConcerns: ConcernDelta[];
  improved: DimensionDelta[];
  regressed: DimensionDelta[];
  baselineReportPath?: string;
  currentReportPath: string;
}

export interface ProviderReadinessReview {
  provider: "openai";
  model: string;
  summary: string;
  evidence: string[];
  concerns: string[];
  recommendations: string[];
  rawText: string;
}
