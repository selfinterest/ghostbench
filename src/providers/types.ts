import type { AgentResponse, EvalCase, RepoContext } from "../types.js";

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

export interface AgentResponseProvider {
  generate(input: ProviderInput): Promise<AgentResponse>;
}
