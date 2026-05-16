export interface EvalCase {
  id: string;
  title: string;
  repoSource: RepoSource;
  task: string;
  expectedFiles: string[];
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
