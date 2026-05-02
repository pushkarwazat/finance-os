/**
 * LLM Provider Adapter Interface
 *
 * Abstracts the language model backend (OpenAI, Anthropic Claude,
 * Google Gemini, Azure OpenAI, Mistral, a locally hosted model, etc.)
 *
 * TODO: Replace the stub with a real LLM provider connector.
 * See: docs/onboarding/05-llm-provider.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface LlmMessage {
  role: MessageRole;
  content: string;
  name?: string;
  /** For assistant messages that made tool calls. */
  toolCallId?: string;
}

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's input parameters. */
  parameters: Record<string, unknown>;
}

export interface LlmCompletionRequest {
  model: string;
  messages: LlmMessage[];
  /** Maximum tokens in the response. */
  maxTokens?: number;
  /** Temperature (0-2). 0 = deterministic. */
  temperature?: number;
  /** Top-p nucleus sampling. */
  topP?: number;
  /** Tools available to the model (for tool-use / function-calling). */
  tools?: LlmTool[];
  /** Force a specific tool call. */
  toolChoice?: "auto" | "none" | { name: string };
  /** Structured output schema (JSON mode). */
  responseFormat?: { type: "json_object" } | { type: "json_schema"; schema: Record<string, unknown> };
  /** Stop sequences. */
  stop?: string[];
  /** Used to seed deterministic outputs where supported. */
  seed?: number;
  requestId?: string;
  traceId?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface LlmCompletionChoice {
  message: LlmMessage;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  toolCalls?: LlmToolCall[];
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Cost in USD if the adapter can compute it. */
  costUsd?: number;
}

export interface LlmCompletionResponse {
  id: string;
  model: string;
  choices: LlmCompletionChoice[];
  usage: LlmUsage;
  executionMs: number;
  cached: boolean;
}

export interface LlmEmbeddingRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
  requestId?: string;
}

export interface LlmEmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: { promptTokens: number; totalTokens: number };
  executionMs: number;
}

export interface LlmProviderHealthStatus {
  available: boolean;
  latencyMs?: number;
  modelsAvailable?: string[];
  error?: string;
}

export interface LlmProviderLimits {
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsToolCalls: boolean;
  supportsVision: boolean;
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface LlmProviderAdapter {
  readonly name: string;

  /**
   * Generate a chat completion.
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;

  /**
   * Generate text embeddings for RAG ingestion or query encoding.
   */
  embed(request: LlmEmbeddingRequest): Promise<LlmEmbeddingResponse>;

  /**
   * Return limits for a given model (context window, output tokens, etc.).
   */
  getLimits(model: string): LlmProviderLimits;

  /**
   * Health check — called by /healthz.
   */
  healthCheck(): Promise<LlmProviderHealthStatus>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement OpenAiLlmAdapter, AnthropicLlmAdapter, AzureOpenAiLlmAdapter
// ─────────────────────────────────────────────────────────────────────────────

const STUB_RESPONSE =
  "[FinanceOS stub] No LLM provider is configured. See docs/onboarding/05-llm-provider.md to wire in OpenAI, Anthropic, or Azure OpenAI.";

export class StubLlmProviderAdapter implements LlmProviderAdapter {
  readonly name = "stub-llm-provider";

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    // TODO: Connect to real LLM provider. See docs/onboarding/05-llm-provider.md
    void request;
    return {
      id: "stub-completion",
      model: request.model,
      choices: [{
        message: { role: "assistant", content: STUB_RESPONSE },
        finishReason: "stop",
      }],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      executionMs: 0,
      cached: false,
    };
  }

  async embed(request: LlmEmbeddingRequest): Promise<LlmEmbeddingResponse> {
    // TODO: Connect to real embedding model. See docs/onboarding/05-llm-provider.md
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const dim = request.dimensions ?? 1536;
    return {
      embeddings: inputs.map(() => new Array(dim).fill(0) as number[]),
      model: request.model,
      usage: { promptTokens: 0, totalTokens: 0 },
      executionMs: 0,
    };
  }

  getLimits(_model: string): LlmProviderLimits {
    return {
      maxContextTokens: 128_000,
      maxOutputTokens: 4_096,
      supportsToolCalls: false,
      supportsVision: false,
      supportsJsonMode: false,
      supportsStreaming: false,
    };
  }

  async healthCheck(): Promise<LlmProviderHealthStatus> {
    return { available: false, error: "StubLlmProviderAdapter: no real LLM provider configured. See docs/onboarding/05-llm-provider.md" };
  }
}
