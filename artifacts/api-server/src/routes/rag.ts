import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  MOCK_FINANCE_DOCUMENTS,
  MOCK_CHUNKS,
  RETRIEVAL_EVAL_CASES,
  runEvalSuite,
  mockRetrieve,
  mockIngester,
  DEFAULT_MOCK_PROVIDER_CONFIG,
  DOCUMENT_TYPE_META,
  SensitivityLevelSchema,
  DocumentTypeSchema,
} from "@financeos/rag";
import { BedrockLlmAdapter } from "@financeos/adapters";
import { container } from "@financeos/container";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Bedrock embedding adapter — used for query encoding when configured
// ─────────────────────────────────────────────────────────────────────────────

const useBedrockEmbeddings =
  process.env.LLM_PROVIDER === "bedrock" && process.env.AWS_REGION !== undefined;

const bedrockEmbedder = useBedrockEmbeddings ? new BedrockLlmAdapter() : null;

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a retrieval request with defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TENANT = "tenant-demo-001";

function buildRequest(
  question: string,
  filters: Record<string, unknown> = {},
  options: Record<string, unknown> = {}
) {
  return {
    requestId: randomUUID(),
    question,
    mode: "hybrid" as const,
    filters: {
      tenantId: DEFAULT_TENANT,
      ...filters,
    },
    hybrid: {
      dense: { topK: 20, minScore: 0.25, embeddingProviderId: "mock", metric: "cosine" as const },
      keyword: { topK: 20, algorithm: "bm25" as const, bm25K1: 1.2, bm25B: 0.75, queryExpansion: true },
      alpha: 0.6,
      rrfK: 60,
    },
    rerank: { enabled: true, providerId: "mock", model: "mock-rerank-v1", topK: 5, minScore: 0.2 },
    citation: { maxCitations: 5, minScore: 0.35, maxExcerptLength: 500, deduplicateSamePage: true, preferTableCitationsForNumbers: true, includeSensitivityMeta: true },
    ...options,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/status — pipeline capability manifest
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/status", (_req, res) => {
  res.json({
    status: "operational",
    version: "1.0.0",
    schemaVersion: "rag.financeos.io/v1",
    providerConfig: {
      vectorStore: DEFAULT_MOCK_PROVIDER_CONFIG.vectorStore.provider,
      embedding: `${DEFAULT_MOCK_PROVIDER_CONFIG.embedding.provider} / ${DEFAULT_MOCK_PROVIDER_CONFIG.embedding.model}`,
      reranker: DEFAULT_MOCK_PROVIDER_CONFIG.reranker
        ? `${DEFAULT_MOCK_PROVIDER_CONFIG.reranker.provider} / ${DEFAULT_MOCK_PROVIDER_CONFIG.reranker.model}`
        : null,
      parser: DEFAULT_MOCK_PROVIDER_CONFIG.parser.provider,
    },
    capabilities: {
      denseRetrieval: true,
      keywordRetrieval: true,
      hybridRetrieval: DEFAULT_MOCK_PROVIDER_CONFIG.enableHybridRetrieval,
      reranking: DEFAULT_MOCK_PROVIDER_CONFIG.enableReranking,
      tableAwareChunking: true,
      nerEnrichment: DEFAULT_MOCK_PROVIDER_CONFIG.enableNER,
      tenantIsolation: true,
      graphMetadata: false,
      liveLLM: false,
    },
    documentTypes: Object.entries(DOCUMENT_TYPE_META).map(([type, meta]) => ({
      type,
      label: meta.label,
      description: meta.description,
      defaultSensitivity: meta.defaultSensitivity,
    })),
    indexedDocuments: MOCK_FINANCE_DOCUMENTS.length,
    indexedChunks: MOCK_CHUNKS.length,
    tableChunks: MOCK_CHUNKS.filter((c) => c.contentType === "table").length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rag/search — natural-language document search
// ─────────────────────────────────────────────────────────────────────────────

const SearchBodySchema = z.object({
  question: z.string().min(1).max(4000),
  mode: z.enum(["dense", "keyword", "hybrid", "metadata_only"]).default("hybrid"),
  documentTypes: z.array(DocumentTypeSchema).optional(),
  fiscalYears: z.array(z.number().int()).optional(),
  periods: z.array(z.string()).optional(),
  tablesOnly: z.boolean().optional(),
  maxCitations: z.number().int().min(1).max(20).optional(),
  minScore: z.number().min(0).max(1).optional(),
});

router.post("/rag/search", async (req, res, next) => {
  const parsed = SearchBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { question, documentTypes, fiscalYears, periods, tablesOnly, maxCitations, minScore } =
    parsed.data;

  const filters: Record<string, unknown> = {};
  if (documentTypes?.length) filters["documentTypes"] = documentTypes;
  if (fiscalYears?.length) filters["fiscalYears"] = fiscalYears;
  if (periods?.length) filters["periods"] = periods;
  if (tablesOnly) filters["tablesOnly"] = true;

  const options: Record<string, unknown> = {};
  if (maxCitations || minScore) {
    options["citation"] = {
      maxCitations: maxCitations ?? 5,
      minScore: minScore ?? 0.35,
      maxExcerptLength: 500,
      deduplicateSamePage: true,
      preferTableCitationsForNumbers: true,
      includeSensitivityMeta: true,
    };
  }

  // Encode the query with Bedrock Titan Embeddings when configured.
  // The resulting vector is logged and will be forwarded to the real vector
  // store once one is wired into the container (see docs/onboarding/03-vector-db.md).
  let queryEmbedding: number[] | undefined;
  let embeddingMeta: { model: string; dimensions: number; tokenCount: number; latencyMs: number } | undefined;

  if (bedrockEmbedder) {
    try {
      const embResult = await bedrockEmbedder.embed({
        model: process.env.BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
        input: question,
        dimensions: 1024,
        requestId: res.locals.requestId,
      });
      queryEmbedding = embResult.embeddings[0];
      embeddingMeta = {
        model: embResult.model,
        dimensions: queryEmbedding?.length ?? 1024,
        tokenCount: embResult.usage.totalTokens,
        latencyMs: embResult.executionMs,
      };
      req.log.info(
        {
          embeddingModel: embResult.model,
          dimensions: queryEmbedding?.length,
          tokenCount: embResult.usage.totalTokens,
          latencyMs: embResult.executionMs,
          requestId: res.locals.requestId,
        },
        "Bedrock Titan query embedding",
      );
    } catch (err) {
      return next(err);
    }
  }

  // ── Real pgvector search ─────────────────────────────────────────────────
  // When both the embedding and a live vector store are available, run a real
  // cosine-similarity search instead of the mock keyword approximation.
  if (queryEmbedding && !container.isStub("vectorStore")) {
    try {
      const vectorStore = container.get("vectorStore");
      const vectorFilter: Record<string, unknown> = { tenantId: DEFAULT_TENANT };
      if (filters["documentTypes"]) vectorFilter["documentTypes"] = filters["documentTypes"];
      if (filters["tablesOnly"]) vectorFilter["tablesOnly"] = true;

      const results = await vectorStore.search({
        queryEmbedding,
        topK: (options["citation"] as Record<string, number> | undefined)?.["maxCitations"] ?? 5,
        minScore: (options["citation"] as Record<string, number> | undefined)?.["minScore"] ?? 0.1,
        filter: vectorFilter,
        requestId: res.locals.requestId,
      });

      req.log.info(
        { resultCount: results.length, requestId: res.locals.requestId },
        "pgvector search",
      );

      const citations = results.map((r) => ({
        id: randomUUID(),
        documentId: r.document.metadata.documentId,
        documentTitle: r.document.metadata.documentTitle ?? r.document.metadata.documentId,
        chunkIndex: r.document.metadata.chunkIndex ?? 0,
        pageNumber: r.document.metadata.pageNumber ?? null,
        excerpt: r.document.content.slice(0, 500),
        relevanceScore: r.score,
        queryId: randomUUID(),
        sensitivityLevel: r.document.metadata.sensitivityLevel,
      }));

      return res.json({
        answer: citations.length > 0
          ? `Found ${citations.length} relevant passage${citations.length === 1 ? "" : "s"} via semantic search.`
          : "No matching passages found in the document corpus for this query.",
        citations,
        sessionId: null,
        retrievalMode: "dense",
        provider: "pgvector",
        _embedding: embeddingMeta ? { provider: "bedrock", ...embeddingMeta } : undefined,
      });
    } catch (err) {
      req.log.warn({ err }, "pgvector search failed — falling back to mock retriever");
    }
  }

  // ── Mock fallback ─────────────────────────────────────────────────────────
  const request = buildRequest(question, filters, options);
  const answer = mockRetrieve(request);

  res.json({
    ...answer,
    ...(embeddingMeta
      ? { _embedding: { provider: "bedrock", ...embeddingMeta, note: "query vector ready for real vector store" } }
      : {}),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents — list indexed documents
// ─────────────────────────────────────────────────────────────────────────────

const ListDocsQuerySchema = z.object({
  type: DocumentTypeSchema.optional(),
  sensitivity: SensitivityLevelSchema.optional(),
  search: z.string().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/rag/documents", (req, res) => {
  const parsed = ListDocsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { type, sensitivity, search, fiscalYear, limit, offset } = parsed.data;
  let docs = [...MOCK_FINANCE_DOCUMENTS];

  if (type) docs = docs.filter((d) => d.type === type);
  if (sensitivity) docs = docs.filter((d) => d.sensitivityLevel === sensitivity);
  if (fiscalYear) docs = docs.filter((d) => d.fiscalYear === fiscalYear);
  if (search) {
    const s = search.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.filename.toLowerCase().includes(s) ||
        d.tags.some((t) => t.toLowerCase().includes(s))
    );
  }

  const total = docs.length;
  const data = docs.slice(offset, offset + limit);

  const byType = MOCK_FINANCE_DOCUMENTS.reduce<Record<string, number>>((acc, d) => {
    acc[d.type] = (acc[d.type] ?? 0) + 1;
    return acc;
  }, {});

  res.json({ data, total, limit, offset, byType, schemaVersion: "rag.financeos.io/v1" });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents/:id — single document detail
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/documents/:id", (req, res) => {
  const doc = MOCK_FINANCE_DOCUMENTS.find((d) => d.id === req.params["id"]);
  if (!doc) {
    res.status(404).json({ error: "not_found", message: "Document not found" });
    return;
  }
  res.json(doc);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents/:id/chunks — chunks for a document
// ─────────────────────────────────────────────────────────────────────────────

const ChunksQuerySchema = z.object({
  contentType: z.enum(["narrative", "table", "list", "header", "footer", "caption", "footnote", "title_page", "signature_block"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/rag/documents/:id/chunks", (req, res) => {
  const doc = MOCK_FINANCE_DOCUMENTS.find((d) => d.id === req.params["id"]);
  if (!doc) {
    res.status(404).json({ error: "not_found", message: "Document not found" });
    return;
  }

  const parsed = ChunksQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { contentType, limit, offset } = parsed.data;
  let chunks = MOCK_CHUNKS.filter((c) => c.documentId === req.params["id"]);
  if (contentType) chunks = chunks.filter((c) => c.contentType === contentType);

  const total = chunks.length;
  const tableChunks = chunks.filter((c) => c.contentType === "table").length;
  const narrativeChunks = chunks.filter((c) => c.contentType === "narrative").length;
  const avgTokenCount =
    chunks.length > 0
      ? Math.round(chunks.reduce((a, c) => a + c.tokenCount, 0) / chunks.length)
      : 0;

  // Strip embeddings from the response (large + not useful in UI)
  const data = chunks.slice(offset, offset + limit).map(({ embedding: _e, ...c }) => c);

  res.json({ documentId: req.params["id"], data, total, tableChunks, narrativeChunks, avgTokenCount, limit, offset });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rag/ingest — simulate document ingestion pipeline
// ─────────────────────────────────────────────────────────────────────────────

const IngestBodySchema = z.object({
  documentId: z.string(),
  simulate: z.boolean().default(true),
});

router.post("/rag/ingest", async (req, res) => {
  const parsed = IngestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const doc = MOCK_FINANCE_DOCUMENTS.find((d) => d.id === parsed.data.documentId);
  if (!doc) {
    res.status(404).json({ error: "not_found", message: "Document not found" });
    return;
  }

  const job = await mockIngester.run(doc, Buffer.alloc(0));
  res.json(job);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/eval — run retrieval evaluation suite
// ─────────────────────────────────────────────────────────────────────────────

const EvalQuerySchema = z.object({
  tag: z.string().optional(),
  caseId: z.string().optional(),
});

router.get("/rag/eval", (req, res) => {
  const parsed = EvalQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { tag, caseId } = parsed.data;

  const cases = caseId
    ? RETRIEVAL_EVAL_CASES.filter((c) => c.id === caseId)
    : RETRIEVAL_EVAL_CASES;

  const answerFn = (question: string) => {
    const request = buildRequest(question);
    return mockRetrieve(request);
  };

  const result = runEvalSuite(answerFn, cases, tag);
  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/eval/cases — list eval cases
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/eval/cases", (req, res) => {
  const tag = req.query["tag"] as string | undefined;
  const cases = tag
    ? RETRIEVAL_EVAL_CASES.filter((c) => c.tags.includes(tag))
    : RETRIEVAL_EVAL_CASES;
  res.json({ data: cases, total: cases.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/providers — list available provider configs
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/providers", (_req, res) => {
  const embeddingActive = useBedrockEmbeddings
    ? "bedrock"
    : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.provider;
  const embeddingModel = useBedrockEmbeddings
    ? (process.env.BEDROCK_EMBEDDING_MODEL_ID ?? "amazon.titan-embed-text-v2:0")
    : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.model;
  const embeddingDimensions = useBedrockEmbeddings
    ? 1024
    : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.dimensions;

  res.json({
    vectorStore: {
      supported: ["pinecone", "qdrant", "pgvector", "weaviate", "opensearch", "in_memory"],
      active: DEFAULT_MOCK_PROVIDER_CONFIG.vectorStore.provider,
    },
    embedding: {
      supported: ["openai", "cohere", "bedrock", "mock"],
      active: embeddingActive,
      model: embeddingModel,
      dimensions: embeddingDimensions,
      live: useBedrockEmbeddings,
    },
    reranker: {
      supported: ["cohere", "bge", "cross_encoder", "mock"],
      active: DEFAULT_MOCK_PROVIDER_CONFIG.reranker?.provider ?? null,
    },
    parser: {
      supported: ["unstructured", "tika", "pdfplumber", "llamaparse", "mock"],
      active: DEFAULT_MOCK_PROVIDER_CONFIG.parser.provider,
    },
  });
});

export default router;
