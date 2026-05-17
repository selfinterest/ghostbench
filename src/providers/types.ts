import type {
  AgentResponse,
  DimensionScore,
  EvalCase,
  ExecutionCheck,
  ExecutionPolicy,
  FrameworkSignal,
  ProviderReadinessReview,
  ReadinessVerdict,
  RepoContext,
  ScriptInventory,
} from "../types.js";

export type ProviderName = "openai";

export interface ProviderOptions {
  provider: ProviderName;
  model: string;
}

export interface ProviderInput {
  evalCase: EvalCase;
  repoContext: RepoContext;
  model: string;
}

export interface ReadinessProviderInput {
  model: string;
  title: string;
  appBrief: string;
  repoPath: string;
  briefSource: string;
  executionPolicy: ExecutionPolicy;
  repoContext: RepoContext;
  expectedAreas: string[];
  frameworkSignals: FrameworkSignal[];
  scriptInventory: ScriptInventory;
  executionChecks: ExecutionCheck[];
  dimensions: DimensionScore[];
  deterministicScore: number;
  deterministicVerdict: ReadinessVerdict;
  deterministicConcerns: string[];
  deterministicEvidence: string[];
}

export interface AgentResponseProvider {
  generate(input: ProviderInput): Promise<AgentResponse>;
  generateReadinessReview(input: ReadinessProviderInput): Promise<ProviderReadinessReview>;
}
