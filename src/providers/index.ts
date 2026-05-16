import { OpenAIProvider } from "./openai.js";
import type { AgentResponseProvider, ProviderOptions } from "./types.js";

export function createProvider(options: ProviderOptions): AgentResponseProvider {
  if (options.provider === "openai") {
    return new OpenAIProvider();
  }

  const exhaustive: never = options.provider;
  throw new Error(`Unsupported provider: ${exhaustive}`);
}

export type { ProviderOptions } from "./types.js";
