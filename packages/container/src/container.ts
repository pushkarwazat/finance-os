/**
 * Dependency Injection Container
 *
 * A lightweight, typed registry that holds the single active instance of
 * each infrastructure adapter. Swap adapters by calling register() before
 * the application starts — no code changes required in route handlers or
 * domain packages.
 *
 * Usage:
 *   import { container } from "@financeos/container";
 *   const llm = container.get("llmProvider");
 *   const result = await llm.complete({ model: "gpt-4o", messages });
 *
 * Wiring in production (in your server entry point):
 *   import { container } from "@financeos/container";
 *   import { OpenAiLlmAdapter } from "./adapters/openai.js";   // your impl
 *   container.register("llmProvider", new OpenAiLlmAdapter());
 *
 * TODO: Wire in real adapters. See docs/onboarding/ for each adapter.
 */

import type { SqlWarehouseAdapter } from "@financeos/adapters";
import type { SemanticEngineAdapter } from "@financeos/adapters";
import type { VectorStoreAdapter } from "@financeos/adapters";
import type { RerankerAdapter } from "@financeos/adapters";
import type { LlmProviderAdapter } from "@financeos/adapters";
import type { AuthProviderAdapter } from "@financeos/adapters";
import {
  StubSqlWarehouseAdapter,
  StubSemanticEngineAdapter,
  StubVectorStoreAdapter,
  StubRerankerAdapter,
  StubLlmProviderAdapter,
  StubAuthProviderAdapter,
} from "@financeos/adapters";

// ─────────────────────────────────────────────────────────────────────────────
// Registry shape — extend this when you add new adapter types
// ─────────────────────────────────────────────────────────────────────────────

export interface AdapterRegistry {
  sqlWarehouse: SqlWarehouseAdapter;
  semanticEngine: SemanticEngineAdapter;
  vectorStore: VectorStoreAdapter;
  reranker: RerankerAdapter;
  llmProvider: LlmProviderAdapter;
  authProvider: AuthProviderAdapter;
}

export type AdapterKey = keyof AdapterRegistry;

// ─────────────────────────────────────────────────────────────────────────────
// Container class
// ─────────────────────────────────────────────────────────────────────────────

export class FinanceOsContainer {
  private readonly registry: AdapterRegistry;

  constructor() {
    // All slots start with safe stubs.
    // TODO: Replace stubs with real adapters in your production entry point.
    this.registry = {
      sqlWarehouse: new StubSqlWarehouseAdapter(),
      semanticEngine: new StubSemanticEngineAdapter(),
      vectorStore: new StubVectorStoreAdapter(),
      reranker: new StubRerankerAdapter(),
      llmProvider: new StubLlmProviderAdapter(),
      authProvider: new StubAuthProviderAdapter(),
    };
  }

  /**
   * Register a real adapter implementation.
   * Call this in your server entry point before handling any requests.
   */
  register<K extends AdapterKey>(key: K, adapter: AdapterRegistry[K]): this {
    this.registry[key] = adapter;
    return this;
  }

  /**
   * Retrieve an adapter by key. Throws if the slot is not registered.
   */
  get<K extends AdapterKey>(key: K): AdapterRegistry[K] {
    const adapter = this.registry[key];
    if (!adapter) {
      throw new Error(
        `FinanceOsContainer: adapter '${key}' is not registered. ` +
        `Register a real implementation before calling get(). ` +
        `See docs/onboarding/ for instructions.`
      );
    }
    return adapter;
  }

  /**
   * Check whether a real (non-stub) adapter is registered for the given key.
   */
  isStub(key: AdapterKey): boolean {
    return this.registry[key].name.startsWith("stub-");
  }

  /**
   * Run health checks on all registered adapters in parallel.
   * Used by the /healthz endpoint to report infrastructure readiness.
   */
  async healthCheckAll(): Promise<Record<AdapterKey, { ok: boolean; name: string; stub: boolean; error?: string; latencyMs?: number }>> {
    const checks = await Promise.allSettled([
      this.registry.sqlWarehouse.healthCheck(),
      this.registry.semanticEngine.healthCheck(),
      this.registry.vectorStore.healthCheck(),
      this.registry.reranker.healthCheck(),
      this.registry.llmProvider.healthCheck(),
      this.registry.authProvider.healthCheck(),
    ]);

    const keys: AdapterKey[] = ["sqlWarehouse", "semanticEngine", "vectorStore", "reranker", "llmProvider", "authProvider"];

    return Object.fromEntries(
      keys.map((key, i) => {
        const result = checks[i];
        const adapter = this.registry[key];
        if (result.status === "fulfilled") {
          const v = result.value as { connected?: boolean; available?: boolean; latencyMs?: number; error?: string };
          const ok = v.connected ?? v.available ?? false;
          return [key, { ok, name: adapter.name, stub: this.isStub(key), latencyMs: v.latencyMs, error: v.error }];
        }
        return [key, { ok: false, name: adapter.name, stub: this.isStub(key), error: String(result.reason) }];
      })
    ) as Record<AdapterKey, { ok: boolean; name: string; stub: boolean; error?: string; latencyMs?: number }>;
  }

  /**
   * List all registered adapter names — useful for startup logging.
   */
  listAdapters(): Record<AdapterKey, string> {
    return Object.fromEntries(
      (Object.keys(this.registry) as AdapterKey[]).map((k) => [k, this.registry[k].name])
    ) as Record<AdapterKey, string>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton — import this from route handlers and domain packages
// ─────────────────────────────────────────────────────────────────────────────

export const container = new FinanceOsContainer();
