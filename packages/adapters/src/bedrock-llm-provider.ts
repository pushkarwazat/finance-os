/**
 * Amazon Bedrock LLM Provider Adapter
 *
 * Implements LlmProviderAdapter using the AWS Bedrock Runtime API.
 * Supports Anthropic Claude (claude-3-5-sonnet, claude-3-haiku) and
 * Amazon Nova (nova-pro, nova-lite) model families.
 *
 * Required environment variables:
 *   AWS_REGION            — e.g. us-east-1
 *   AWS_ACCESS_KEY_ID     — omit if running with an IAM role
 *   AWS_SECRET_ACCESS_KEY — omit if running with an IAM role
 *   BEDROCK_MODEL_ID      — default: anthropic.claude-3-5-sonnet-20241022-v2:0
 *
 * See: https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { randomUUID } from "node:crypto";
import type {
  LlmProviderAdapter,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmEmbeddingRequest,
  LlmEmbeddingResponse,
  LlmProviderHealthStatus,
  LlmProviderLimits,
} from "./llm-provider.js";

// ─────────────────────────────────────────────────────────────────────────────
// Model families
// ─────────────────────────────────────────────────────────────────────────────

function isClaudeModel(modelId: string): boolean {
  // Handles direct IDs (anthropic.claude-...) and cross-region inference
  // profiles (us.anthropic.claude-..., eu.anthropic.claude-..., ap.anthropic.claude-...)
  return modelId.includes("anthropic.");
}

function isNovaModel(modelId: string): boolean {
  return modelId.includes("amazon.nova");
}

function isTitanModel(modelId: string): boolean {
  return modelId.includes("amazon.titan-text");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-model limits
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_LIMITS: Record<string, LlmProviderLimits> = {
  "anthropic.claude-3-5-sonnet-20241022-v2:0": {
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsToolCalls: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  "anthropic.claude-3-5-haiku-20241022-v1:0": {
    maxContextTokens: 200_000,
    maxOutputTokens: 8_192,
    supportsToolCalls: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  "anthropic.claude-3-haiku-20240307-v1:0": {
    maxContextTokens: 200_000,
    maxOutputTokens: 4_096,
    supportsToolCalls: true,
    supportsVision: true,
    supportsJsonMode: false,
    supportsStreaming: true,
  },
  "amazon.nova-pro-v1:0": {
    maxContextTokens: 300_000,
    maxOutputTokens: 5_120,
    supportsToolCalls: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
  "amazon.nova-lite-v1:0": {
    maxContextTokens: 300_000,
    maxOutputTokens: 5_120,
    supportsToolCalls: true,
    supportsVision: true,
    supportsJsonMode: true,
    supportsStreaming: true,
  },
};

const DEFAULT_LIMITS: LlmProviderLimits = {
  maxContextTokens: 128_000,
  maxOutputTokens: 4_096,
  supportsToolCalls: false,
  supportsVision: false,
  supportsJsonMode: false,
  supportsStreaming: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Payload builders
// ─────────────────────────────────────────────────────────────────────────────

function buildClaudePayload(req: LlmCompletionRequest): Record<string, unknown> {
  const systemMsg = req.messages.find((m) => m.role === "system");
  const conversationMsgs = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: req.maxTokens ?? 2_048,
    ...(systemMsg ? { system: systemMsg.content } : {}),
    messages: conversationMsgs,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.topP !== undefined ? { top_p: req.topP } : {}),
    ...(req.stop ? { stop_sequences: req.stop } : {}),
  };
}

function buildNovaPayload(req: LlmCompletionRequest): Record<string, unknown> {
  const systemMsg = req.messages.find((m) => m.role === "system");
  const conversationMsgs = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: [{ text: m.content }] }));

  return {
    messages: conversationMsgs,
    ...(systemMsg ? { system: [{ text: systemMsg.content }] } : {}),
    inferenceConfig: {
      max_new_tokens: req.maxTokens ?? 2_048,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      ...(req.topP !== undefined ? { top_p: req.topP } : {}),
    },
  };
}

function buildTitanPayload(req: LlmCompletionRequest): Record<string, unknown> {
  const userMsg = req.messages.filter((m) => m.role !== "system").pop();
  return {
    inputText: userMsg?.content ?? "",
    textGenerationConfig: {
      maxTokenCount: req.maxTokens ?? 2_048,
      temperature: req.temperature ?? 0.3,
      topP: req.topP ?? 0.9,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseClaudeResponse(
  body: Record<string, unknown>,
  modelId: string,
  startMs: number,
): LlmCompletionResponse {
  const content = body.content as Array<{ type: string; text: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "";
  const usage = body.usage as { input_tokens: number; output_tokens: number };

  return {
    id: (body.id as string) ?? randomUUID(),
    model: modelId,
    choices: [{ message: { role: "assistant", content: text }, finishReason: (body.stop_reason as string === "end_turn" ? "stop" : "stop") }],
    usage: {
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    },
    executionMs: Date.now() - startMs,
    cached: false,
  };
}

function parseNovaResponse(
  body: Record<string, unknown>,
  modelId: string,
  startMs: number,
): LlmCompletionResponse {
  const output = body.output as { message: { role: string; content: Array<{ text: string }> } };
  const text = output?.message?.content?.[0]?.text ?? "";
  const usage = body.usage as { inputTokens: number; outputTokens: number };

  return {
    id: randomUUID(),
    model: modelId,
    choices: [{ message: { role: "assistant", content: text }, finishReason: "stop" }],
    usage: {
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
      totalTokens: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
    },
    executionMs: Date.now() - startMs,
    cached: false,
  };
}

function parseTitanResponse(
  body: Record<string, unknown>,
  modelId: string,
  startMs: number,
): LlmCompletionResponse {
  const results = body.results as Array<{ outputText: string; tokenCount: number }>;
  const text = results?.[0]?.outputText ?? "";
  const inputTokenCount = body.inputTextTokenCount as number ?? 0;

  return {
    id: randomUUID(),
    model: modelId,
    choices: [{ message: { role: "assistant", content: text }, finishReason: "stop" }],
    usage: {
      promptTokens: inputTokenCount,
      completionTokens: results?.[0]?.tokenCount ?? 0,
      totalTokens: inputTokenCount + (results?.[0]?.tokenCount ?? 0),
    },
    executionMs: Date.now() - startMs,
    cached: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class BedrockLlmAdapter implements LlmProviderAdapter {
  readonly name = "bedrock";

  private readonly client: BedrockRuntimeClient;
  private readonly defaultModelId: string;

  constructor(options?: { region?: string; modelId?: string }) {
    const region = options?.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.defaultModelId =
      options?.modelId ??
      process.env.BEDROCK_MODEL_ID ??
      "anthropic.claude-3-5-sonnet-20241022-v2:0";

    this.client = new BedrockRuntimeClient({ region });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const modelId = request.model || this.defaultModelId;
    const startMs = Date.now();

    let payload: Record<string, unknown>;
    if (isClaudeModel(modelId)) {
      payload = buildClaudePayload(request);
    } else if (isNovaModel(modelId)) {
      payload = buildNovaPayload(request);
    } else if (isTitanModel(modelId)) {
      payload = buildTitanPayload(request);
    } else {
      // Default to Claude format for unknown models
      payload = buildClaudePayload(request);
    }

    const command = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const raw = await this.client.send(command);
    const responseBody = JSON.parse(
      new TextDecoder().decode(raw.body),
    ) as Record<string, unknown>;

    if (isClaudeModel(modelId)) {
      return parseClaudeResponse(responseBody, modelId, startMs);
    } else if (isNovaModel(modelId)) {
      return parseNovaResponse(responseBody, modelId, startMs);
    } else {
      return parseTitanResponse(responseBody, modelId, startMs);
    }
  }

  async embed(_request: LlmEmbeddingRequest): Promise<LlmEmbeddingResponse> {
    // Bedrock embedding support via Amazon Titan Embeddings — wire separately
    // if you need RAG embeddings through Bedrock.
    throw new Error(
      "Embeddings via BedrockLlmAdapter not yet implemented. " +
        "Use amazon.titan-embed-text-v2:0 with InvokeModelCommand directly, " +
        "or set EMBEDDING_PROVIDER=bedrock in your env.",
    );
  }

  getLimits(model: string): LlmProviderLimits {
    return MODEL_LIMITS[model] ?? DEFAULT_LIMITS;
  }

  async healthCheck(): Promise<LlmProviderHealthStatus> {
    const startMs = Date.now();
    try {
      await this.complete({
        model: this.defaultModelId,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
        temperature: 0,
      });
      return {
        available: true,
        latencyMs: Date.now() - startMs,
        modelsAvailable: [this.defaultModelId],
      };
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
