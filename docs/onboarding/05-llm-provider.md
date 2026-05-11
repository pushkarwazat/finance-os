# Onboarding: LLM Provider Adapter

**Interface:** `LlmProviderAdapter` (`packages/adapters/src/llm-provider.ts`)  
**DI key:** `llmProvider`  
**Current stub:** `StubLlmProviderAdapter` — returns a placeholder message

---

## What this adapter does

The LLM provider adapter handles two operations:

1. **`complete()`** — Generate a chat completion (answer synthesis, workflow
   narration, compliance commentary). Called by Ask AI routes, agent engine,
   and RAG synthesis.

2. **`embed()`** — Generate text embeddings for document ingestion and
   semantic query encoding. Called by the RAG ingestion pipeline.

Separating completion and embedding allows you to use different models
for each (e.g. `gpt-4o` for generation, `text-embedding-3-large` for indexing).

---

## Supported providers

| Provider | Completion | Embedding | Notes |
|---|---|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini` | `text-embedding-3-large` | Recommended default |
| Azure OpenAI | Any deployed model | Any deployed model | Required for SOC 2 / government |
| **Amazon Bedrock** | **Claude Sonnet 4, Nova Pro** | **Titan Embed v2** | **Active — wired via `BedrockLlmAdapter`** |
| Anthropic | `claude-3-5-sonnet` | (use OpenAI for embeds) | Best reasoning quality |
| Google Gemini | `gemini-1.5-pro` | `text-embedding-004` | Good for multimodal |
| Mistral | `mistral-large` | `mistral-embed` | EU data residency option |
| Local (Ollama) | Any Ollama model | `nomic-embed-text` | Air-gapped deployments |

---

## Implementation steps (OpenAI)

### 1. Install the OpenAI client

```bash
pnpm --filter @workspace/api-server add openai
```

### 2. Create your adapter

```typescript
import OpenAI from "openai";
import {
  LlmProviderAdapter, LlmCompletionRequest, LlmCompletionResponse,
  LlmEmbeddingRequest, LlmEmbeddingResponse, LlmProviderLimits,
} from "@financeos/adapters";

const MODEL_LIMITS: Record<string, LlmProviderLimits> = {
  "gpt-4o":          { maxContextTokens: 128_000, maxOutputTokens: 16_384, supportsToolCalls: true,  supportsVision: true,  supportsJsonMode: true,  supportsStreaming: true },
  "gpt-4o-mini":     { maxContextTokens: 128_000, maxOutputTokens: 16_384, supportsToolCalls: true,  supportsVision: true,  supportsJsonMode: true,  supportsStreaming: true },
  "o1-mini":         { maxContextTokens: 128_000, maxOutputTokens: 65_536, supportsToolCalls: false, supportsVision: false, supportsJsonMode: false, supportsStreaming: false },
};

export class OpenAiLlmAdapter implements LlmProviderAdapter {
  readonly name = "openai";
  private client: OpenAI;

  constructor(opts: { apiKey: string; organization?: string }) {
    this.client = new OpenAI({ apiKey: opts.apiKey, organization: opts.organization });
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const t = Date.now();
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      tools: request.tools?.map(t => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
      response_format: request.responseFormat as OpenAI.ResponseFormat,
      stop: request.stop,
      seed: request.seed,
    });

    return {
      id: response.id,
      model: response.model,
      choices: response.choices.map(c => ({
        message: { role: c.message.role, content: c.message.content ?? "" },
        finishReason: (c.finish_reason ?? "stop") as LlmCompletionResponse["choices"][0]["finishReason"],
        toolCalls: c.message.tool_calls?.map(tc => ({
          id: tc.id, name: tc.function.name, arguments: tc.function.arguments,
        })),
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      executionMs: Date.now() - t,
      cached: false,
    };
  }

  async embed(request: LlmEmbeddingRequest): Promise<LlmEmbeddingResponse> {
    const t = Date.now();
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const response = await this.client.embeddings.create({
      model: request.model,
      input: inputs,
      dimensions: request.dimensions,
    });
    return {
      embeddings: response.data.map(d => d.embedding),
      model: response.model,
      usage: { promptTokens: response.usage.prompt_tokens, totalTokens: response.usage.total_tokens },
      executionMs: Date.now() - t,
    };
  }

  getLimits(model: string): LlmProviderLimits {
    return MODEL_LIMITS[model] ?? MODEL_LIMITS["gpt-4o"]!;
  }

  async healthCheck() {
    const t = Date.now();
    try {
      await this.client.models.retrieve("gpt-4o-mini");
      return { available: true, latencyMs: Date.now() - t, modelsAvailable: Object.keys(MODEL_LIMITS) };
    } catch (err) {
      return { available: false, error: String(err) };
    }
  }
}
```

### 3. Register in the DI container

```typescript
container.register("llmProvider", new OpenAiLlmAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID,
}));
```

---

## Finance-specific prompt guidelines

All prompts sent to the LLM must:
1. Include a **system prompt** that scopes the model to financial analysis
2. Attach **evidence citations** from RAG so answers are grounded
3. Specify the **fiscal period** so the model doesn't infer dates
4. Set `temperature: 0` for all deterministic financial calculations
5. Use **structured output** (JSON mode) for any parseable responses

See `packages/agents/src/engine/mock-engine.ts` for the system prompt template.

---

## Cost controls

| Control | Implementation |
|---|---|
| Token budget | `maxTokens` per request — set by governance policy |
| Model routing | Use `gpt-4o-mini` for classification, `gpt-4o` for synthesis |
| Response caching | Cache by (systemPrompt hash + userMessage hash) |
| Rate limiting | Implement a token-bucket per tenantId |
| Cost attribution | Log `usage.costUsd` by tenantId and workflowType |

---

## Production checklist

- [ ] Store API key in secrets manager, rotate quarterly
- [ ] Enable Azure OpenAI for data residency / SOC 2 compliance
- [ ] Set `temperature: 0` for financial calculation prompts
- [ ] Log all prompts + completions to an immutable audit store
- [ ] Implement AbstentionPolicy checks before every LLM call
- [ ] Add PII scrubbing before sending any text to the LLM
