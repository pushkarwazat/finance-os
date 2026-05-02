import { z } from "zod";
import { DocumentTypeSchema, SensitivityLevelSchema } from "../documents/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tenant isolation strategy
// ─────────────────────────────────────────────────────────────────────────────

export const TenantIsolationStrategySchema = z.enum([
  /**
   * Namespace isolation — each tenant's vectors are stored in a separate
   * namespace within the same collection/index.
   * Supported by: Pinecone (native), Weaviate (multi-tenancy feature).
   * Recommended for SaaS with many small tenants.
   */
  "namespace",
  /**
   * Filter isolation — all vectors share one collection; tenant ID is a
   * metadata field filtered on every query.
   * Supported by all providers. Simpler to manage; less strict isolation.
   */
  "filter",
  /**
   * Collection isolation — each tenant has its own collection/index.
   * Strongest isolation; highest operational overhead.
   * Recommended for regulated enterprises with strict data residency.
   */
  "collection",
]);
export type TenantIsolationStrategy = z.infer<typeof TenantIsolationStrategySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tenant configuration
// ─────────────────────────────────────────────────────────────────────────────

export const TenantConfigSchema = z.object({
  /** Unique tenant identifier (UUID or slug). */
  tenantId: z.string(),
  /** Human-readable display name. */
  displayName: z.string(),
  /** Isolation strategy for this tenant. */
  isolationStrategy: TenantIsolationStrategySchema.default("filter"),
  /**
   * Namespace or collection suffix used when strategy is "namespace" or "collection".
   * Defaults to tenantId when not specified.
   */
  namespace: z.string().optional(),
  /** Document types this tenant is allowed to store and retrieve. */
  allowedDocumentTypes: z.array(DocumentTypeSchema).default([
    "contract",
    "invoice",
    "policy_doc",
    "close_memo",
    "board_deck",
    "audit_workpaper",
    "sop",
  ]),
  /** Maximum sensitivity level a tenant can access. */
  maxSensitivityLevel: SensitivityLevelSchema.default("restricted"),
  /** Maximum total chunks stored per tenant (0 = unlimited). */
  maxChunks: z.number().int().min(0).default(0),
  /** Maximum total documents stored per tenant (0 = unlimited). */
  maxDocuments: z.number().int().min(0).default(0),
  /** Maximum retrieval requests per minute. */
  retrievalRateLimit: z.number().int().min(0).default(120),
  /** Maximum ingestion jobs in flight simultaneously. */
  maxConcurrentIngestionJobs: z.number().int().min(1).default(5),
  /** Whether this tenant can access cross-document graph relationships. */
  graphAccessEnabled: z.boolean().default(false),
  /** Whether this tenant is active. */
  active: z.boolean().default(true),
  /** ISO 8601 creation timestamp. */
  createdAt: z.string().datetime(),
  /** ISO 8601 last update timestamp. */
  updatedAt: z.string().datetime(),
});
export type TenantConfig = z.infer<typeof TenantConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tenant context — attached to every request at the middleware layer
// ─────────────────────────────────────────────────────────────────────────────

export const TenantContextSchema = z.object({
  tenantId: z.string(),
  /** Resolved namespace or collection identifier for the vector store. */
  vectorNamespace: z.string(),
  isolationStrategy: TenantIsolationStrategySchema,
  allowedDocumentTypes: z.array(DocumentTypeSchema),
  maxSensitivityLevel: SensitivityLevelSchema,
});
export type TenantContext = z.infer<typeof TenantContextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Metadata filter builder — builds tenant-safe MetadataFilter objects
// ─────────────────────────────────────────────────────────────────────────────

export class MetadataFilterBuilder {
  private filters: Record<string, unknown> = {};
  private readonly tenantId: string;
  private readonly tenantConfig?: TenantConfig;

  constructor(tenantId: string, tenantConfig?: TenantConfig) {
    this.tenantId = tenantId;
    this.tenantConfig = tenantConfig;
    this.filters = { tenantId };
  }

  documentIds(ids: string[]): this {
    this.filters["documentIds"] = ids;
    return this;
  }

  documentTypes(types: string[]): this {
    const allowed = this.tenantConfig?.allowedDocumentTypes ?? types;
    this.filters["documentTypes"] = types.filter((t) => allowed.includes(t as any));
    return this;
  }

  fiscalYears(years: number[]): this {
    this.filters["fiscalYears"] = years;
    return this;
  }

  periods(periods: string[]): this {
    this.filters["periods"] = periods;
    return this;
  }

  requiredTags(tags: string[]): this {
    this.filters["requiredTags"] = tags;
    return this;
  }

  anyTags(tags: string[]): this {
    this.filters["anyTags"] = tags;
    return this;
  }

  tablesOnly(): this {
    this.filters["tablesOnly"] = true;
    return this;
  }

  excludeTables(): this {
    this.filters["excludeTables"] = true;
    return this;
  }

  maxSensitivity(level: string): this {
    const maxAllowed = this.tenantConfig?.maxSensitivityLevel ?? "restricted";
    const LEVELS = ["public", "internal", "confidential", "restricted"];
    const requested = LEVELS.indexOf(level);
    const ceiling = LEVELS.indexOf(maxAllowed);
    this.filters["maxSensitivityLevel"] = LEVELS[Math.min(requested, ceiling)];
    return this;
  }

  build(): Record<string, unknown> {
    return { ...this.filters, tenantId: this.tenantId };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant access control — checks a request against tenant config
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantAccessDecision {
  allowed: boolean;
  reason?: string;
  redactedFields?: string[];
}

export function checkTenantAccess(
  tenantConfig: TenantConfig,
  documentType: string,
  sensitivityLevel: string
): TenantAccessDecision {
  if (!tenantConfig.active) {
    return { allowed: false, reason: "Tenant account is inactive" };
  }

  const typeAllowed = tenantConfig.allowedDocumentTypes.includes(documentType as any);
  if (!typeAllowed) {
    return {
      allowed: false,
      reason: `Document type '${documentType}' is not permitted for this tenant`,
    };
  }

  const LEVELS = ["public", "internal", "confidential", "restricted"];
  const requested = LEVELS.indexOf(sensitivityLevel);
  const ceiling = LEVELS.indexOf(tenantConfig.maxSensitivityLevel);
  if (requested > ceiling) {
    return {
      allowed: false,
      reason: `Sensitivity level '${sensitivityLevel}' exceeds this tenant's maximum ('${tenantConfig.maxSensitivityLevel}')`,
    };
  }

  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant registry — in-memory store (swap for DB in production)
// ─────────────────────────────────────────────────────────────────────────────

export interface TenantRegistry {
  get(tenantId: string): TenantConfig | undefined;
  set(config: TenantConfig): void;
  list(): TenantConfig[];
  resolveContext(tenantId: string): TenantContext | undefined;
}

export class InMemoryTenantRegistry implements TenantRegistry {
  private readonly store = new Map<string, TenantConfig>();

  get(tenantId: string): TenantConfig | undefined {
    return this.store.get(tenantId);
  }

  set(config: TenantConfig): void {
    this.store.set(config.tenantId, config);
  }

  list(): TenantConfig[] {
    return [...this.store.values()];
  }

  resolveContext(tenantId: string): TenantContext | undefined {
    const config = this.store.get(tenantId);
    if (!config) return undefined;
    return {
      tenantId: config.tenantId,
      vectorNamespace: config.namespace ?? config.tenantId,
      isolationStrategy: config.isolationStrategy,
      allowedDocumentTypes: config.allowedDocumentTypes,
      maxSensitivityLevel: config.maxSensitivityLevel,
    };
  }
}
