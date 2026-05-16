import OpenAI from "openai";
import { buildAgentResponsePrompt } from "./prompt.js";
import type { AgentResponseProvider, ProviderInput } from "./types.js";

const MAX_OUTPUT_TOKENS = 1_600;

export class OpenAIProvider implements AgentResponseProvider {
  async generate(input: ProviderInput) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when using --provider openai");
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: input.model,
      instructions:
        "Generate a concise, repo-grounded coding-agent response. Avoid invented files and symbols. State uncertainty clearly.",
      input: buildAgentResponsePrompt(input.evalCase, input.repoContext),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    });

    const text = response.output_text.trim();
    if (!text) {
      throw new Error(`OpenAI provider returned an empty Agent Response for model ${input.model}`);
    }

    return {
      name: `OpenAI ${input.model}`,
      sourceType: "provider" as const,
      source: `openai:${input.model}`,
      text,
    };
  }
}
