import OpenAI from "openai";
import { buildAgentResponsePrompt, buildReadinessReviewPrompt } from "./prompt.js";
import type { AgentResponseProvider, ProviderInput, ReadinessProviderInput } from "./types.js";
import type { ProviderReadinessReview } from "../types.js";

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

  async generateReadinessReview(input: ReadinessProviderInput): Promise<ProviderReadinessReview> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required when using --provider openai");
    }

    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: input.model,
      instructions:
        "Review repository readiness from bounded context. Return only valid JSON. Avoid invented files, commands, and product behavior.",
      input: buildReadinessReviewPrompt(input),
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    });

    const text = response.output_text.trim();
    if (!text) {
      throw new Error(`OpenAI provider returned an empty readiness review for model ${input.model}`);
    }

    return parseReadinessReview(text, input.model);
  }
}

function parseReadinessReview(text: string, model: string): ProviderReadinessReview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch (error) {
    throw new Error(`OpenAI provider returned invalid readiness JSON for model ${model}: ${formatError(error)}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`OpenAI provider returned invalid readiness JSON for model ${model}: expected an object`);
  }

  const value = parsed as Record<string, unknown>;
  return {
    provider: "openai",
    model,
    summary: readString(value.summary),
    evidence: readStringArray(value.evidence),
    concerns: readStringArray(value.concerns),
    recommendations: readStringArray(value.recommendations),
    rawText: text,
  };
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => (typeof item === "string" && item.trim().length > 0 ? [item.trim()] : []));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
