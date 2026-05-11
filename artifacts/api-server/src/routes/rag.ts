import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { z } from "zod";
import {
  RETRIEVAL_EVAL_CASES,
  runEvalSuite,
  mockRetrieve,
  mockIngester,
  DEFAULT_MOCK_PROVIDER_CONFIG,
  DOCUMENT_TYPE_META,
  SensitivityLevelSchema,
  DocumentTypeSchema,
  RAG_DOCUMENTS,
} from "@financeos/rag";
import { container } from "@financeos/container";
import { BedrockLlmAdapter } from "@financeos/adapters";
import type { VectorDocument } from "@financeos/adapters";
import { retrievePassages } from "../lib/rag-retriever.js";
import {
  insertDocument,
  updateDocumentStatus,
  findDocumentById,
  listDocuments,
  getDocumentStats,
  getChunksByDocumentId,
} from "../lib/doc-repo.js";
import { chunkText } from "../lib/chunker.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Embedding singleton (reuse across requests)
// ─────────────────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL =
  process.env["BEDROCK_EMBEDDING_MODEL_ID"] ?? "amazon.titan-embed-text-v2:0";

const USE_BEDROCK =
  process.env["LLM_PROVIDER"] === "bedrock" && !!process.env["AWS_REGION"];

const embedder = USE_BEDROCK ? new BedrockLlmAdapter() : null;

// ─────────────────────────────────────────────────────────────────────────────
// Multer — memory storage, 20 MB limit, PDF / DOCX / TXT only
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_MIMES.has(file.mimetype) ||
      /\.(pdf|docx|txt)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper — build a mock retrieval request with defaults
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TENANT = "tenant-demo-001";

function buildRequest(
  question: string,
  filters: Record<string, unknown> = {},
  options: Record<string, unknown> = {},
) {
  return {
    requestId: randomUUID(),
    question,
    mode: "hybrid" as const,
    filters: { tenantId: DEFAULT_TENANT, ...filters },
    hybrid: {
      dense: {
        topK: 20,
        minScore: 0.25,
        embeddingProviderId: "mock",
        metric: "cosine" as const,
      },
      keyword: {
        topK: 20,
        algorithm: "bm25" as const,
        bm25K1: 1.2,
        bm25B: 0.75,
        queryExpansion: true,
      },
      alpha: 0.6,
      rrfK: 60,
    },
    rerank: {
      enabled: true,
      providerId: "mock",
      model: "mock-rerank-v1",
      topK: 5,
      minScore: 0.2,
    },
    citation: {
      maxCitations: 5,
      minScore: 0.35,
      maxExcerptLength: 500,
      deduplicateSamePage: true,
      preferTableCitationsForNumbers: true,
      includeSensitivityMeta: true,
    },
    ...options,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/status — pipeline capability manifest (live DB counts)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/status", async (_req, res, next) => {
  try {
    const stats = await getDocumentStats();
    res.json({
      status: "operational",
      version: "1.0.0",
      schemaVersion: "rag.financeos.io/v1",
      providerConfig: {
        vectorStore: container.isStub("vectorStore")
          ? DEFAULT_MOCK_PROVIDER_CONFIG.vectorStore.provider
          : "pgvector",
        embedding: USE_BEDROCK
          ? `bedrock / ${EMBEDDING_MODEL}`
          : `${DEFAULT_MOCK_PROVIDER_CONFIG.embedding.provider} / ${DEFAULT_MOCK_PROVIDER_CONFIG.embedding.model}`,
        reranker: DEFAULT_MOCK_PROVIDER_CONFIG.reranker
          ? `${DEFAULT_MOCK_PROVIDER_CONFIG.reranker.provider} / ${DEFAULT_MOCK_PROVIDER_CONFIG.reranker.model}`
          : null,
        parser: "pdf-parse / mammoth",
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
        liveLLM: USE_BEDROCK,
        documentUpload: !container.isStub("vectorStore") && USE_BEDROCK,
      },
      documentTypes: Object.entries(DOCUMENT_TYPE_META).map(([type, meta]) => ({
        type,
        label: meta.label,
        description: meta.description,
        defaultSensitivity: meta.defaultSensitivity,
      })),
      indexedDocuments: stats.total,
      indexedChunks: stats.indexedChunks,
      tableChunks: stats.tableChunks,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rag/search — natural-language document search
// ─────────────────────────────────────────────────────────────────────────────

const SearchBodySchema = z.object({
  question: z.string().min(1).max(4000),
  mode: z
    .enum(["dense", "keyword", "hybrid", "metadata_only"])
    .default("hybrid"),
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

  // ── Real semantic search via pgvector ─────────────────────────────────────
  if (!container.isStub("vectorStore")) {
    try {
      const ragResult = await retrievePassages(question, {
        topK: maxCitations ?? 5,
        minScore: minScore ?? 0.1,
        tablesOnly: tablesOnly ?? false,
        requestId: res.locals["requestId"] as string | undefined,
      });

      req.log.info(
        {
          resultCount: ragResult.passages.length,
          embeddingLatencyMs: ragResult.embeddingLatencyMs,
          searchLatencyMs: ragResult.searchLatencyMs,
        },
        "RAG search",
      );

      return res.json({
        answer:
          ragResult.passages.length > 0
            ? `Found ${ragResult.passages.length} relevant passage${ragResult.passages.length === 1 ? "" : "s"} via semantic search.`
            : "No matching passages found in the document corpus for this query.",
        citations: ragResult.passages,
        sessionId: null,
        retrievalMode: "dense",
        provider: "pgvector",
        _embedding: {
          provider: "bedrock",
          model: ragResult.embeddingModel,
          dimensions: 1024,
          embeddingLatencyMs: ragResult.embeddingLatencyMs,
          searchLatencyMs: ragResult.searchLatencyMs,
        },
      });
    } catch (err) {
      req.log.warn({ err }, "RAG search failed — falling back to mock retriever");
      return next(err);
    }
  }

  // ── Mock fallback (no live vector store) ──────────────────────────────────
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

  const request = buildRequest(question, filters, options);
  const answer = mockRetrieve(request);
  res.json(answer);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rag/upload — upload, chunk, embed, and index a document
// ─────────────────────────────────────────────────────────────────────────────

const UploadBodySchema = z.object({
  title: z.string().min(1).max(500),
  type: DocumentTypeSchema.default("policy_doc"),
  sensitivityLevel: SensitivityLevelSchema.default("internal"),
  fiscalYear: z.coerce.number().int().min(2000).max(2099).optional(),
  period: z.string().max(50).optional(),
  tags: z.string().max(500).optional(),
});

router.post(
  "/rag/upload",
  upload.single("file"),
  async (req, res, next) => {
    if (!req.file) {
      res
        .status(400)
        .json({ error: "bad_request", message: "No file uploaded. Send a multipart/form-data request with a 'file' field (PDF, DOCX, or TXT, max 20 MB)." });
      return;
    }

    if (!embedder || container.isStub("vectorStore")) {
      res.status(503).json({
        error: "service_unavailable",
        message:
          "Embedding and vector store adapters are required for document upload. Ensure LLM_PROVIDER=bedrock and DATABASE_URL are configured.",
      });
      return;
    }

    const parsed = UploadBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "bad_request", message: parsed.error.message });
      return;
    }

    const { title, type, sensitivityLevel, fiscalYear, period, tags: tagsRaw } =
      parsed.data;
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const file = req.file;
    const docId = randomUUID();

    // ── 1. Create document record (status=processing) ──────────────────────
    let doc = await insertDocument({
      id: docId,
      title,
      filename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      type,
      sensitivityLevel,
      tags,
      fiscalYear,
      period,
      uploadedBy: "system",
    });

    try {
      // ── 2. Extract text ──────────────────────────────────────────────────
      let text = "";
      let pageCount: number | undefined;

      const isPdf =
        file.mimetype === "application/pdf" ||
        /\.pdf$/i.test(file.originalname);
      const isDocx =
        file.mimetype.includes("wordprocessingml") ||
        /\.docx$/i.test(file.originalname);

      if (isPdf) {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const textResult = await parser.getText();
        text = textResult.text;
        pageCount = textResult.pages.length;
        await parser.destroy();
      } else if (isDocx) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else {
        text = file.buffer.toString("utf-8");
      }

      if (!text.trim()) {
        doc = (await updateDocumentStatus(doc.id, "error")) ?? doc;
        res.status(422).json({
          error: "empty_document",
          message:
            "Could not extract any text from the uploaded file. Ensure the file is not encrypted or image-only.",
          document: doc,
        });
        return;
      }

      req.log.info(
        { documentId: docId, chars: text.length, pageCount },
        "Document text extracted",
      );

      // ── 3. Chunk the text ────────────────────────────────────────────────
      const textChunks = chunkText(text);

      req.log.info(
        { documentId: docId, chunkCount: textChunks.length },
        "Document chunked",
      );

      // ── 4. Embed chunks in batches of 5 and upsert to pgvector ──────────
      const BATCH = 5;
      const vectorDocs: VectorDocument[] = [];

      for (let i = 0; i < textChunks.length; i += BATCH) {
        const batch = textChunks.slice(i, i + BATCH);

        const embedded = await Promise.all(
          batch.map(async (chunk) => {
            const embResult = await embedder.embed({
              model: EMBEDDING_MODEL,
              input: chunk.text,
              dimensions: 1024,
              requestId: res.locals["requestId"] as string | undefined,
            });
            const embedding = embResult.embeddings[0] ?? [];

            return {
              id: `${docId}-chunk-${chunk.chunkIndex}`,
              content: chunk.text,
              embedding,
              metadata: {
                documentId: docId,
                documentTitle: title,
                chunkIndex: chunk.chunkIndex,
                contentType: "narrative",
                sectionTitle: chunk.sectionTitle ?? undefined,
                sensitivityLevel:
                  sensitivityLevel as VectorDocument["metadata"]["sensitivityLevel"],
                tenantId: DEFAULT_TENANT,
                metadataTags: tags,
                type,
                fiscalYear: fiscalYear ?? undefined,
                period: period ?? undefined,
                tokenCount: chunk.tokenCount,
              },
            } satisfies VectorDocument;
          }),
        );

        vectorDocs.push(...embedded);
      }

      const vectorStore = container.get("vectorStore");
      const { upsertedCount } = await vectorStore.upsert({
        documents: vectorDocs,
      });

      req.log.info(
        { documentId: docId, upsertedCount },
        "Document chunks indexed in pgvector",
      );

      // ── 5. Finalise document record ──────────────────────────────────────
      doc =
        (await updateDocumentStatus(docId, "indexed", {
          chunkCount: upsertedCount,
          pageCount,
        })) ?? doc;

      res.status(201).json(doc);
    } catch (err) {
      req.log.error({ err, documentId: docId }, "Document upload failed");
      await updateDocumentStatus(docId, "error").catch(() => undefined);
      next(err);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents — list indexed documents (from DB)
// ─────────────────────────────────────────────────────────────────────────────

const ListDocsQuerySchema = z.object({
  type: DocumentTypeSchema.optional(),
  sensitivity: SensitivityLevelSchema.optional(),
  search: z.string().optional(),
  fiscalYear: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/rag/documents", async (req, res, next) => {
  const parsed = ListDocsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { type, sensitivity, search, fiscalYear, limit, offset } = parsed.data;

  try {
    const { data, total } = await listDocuments({
      type,
      sensitivity,
      search,
      fiscalYear,
      limit,
      offset,
    });

    const byType = data.reduce<Record<string, number>>((acc, d) => {
      acc[d.type] = (acc[d.type] ?? 0) + 1;
      return acc;
    }, {});

    res.json({ data, total, limit, offset, byType, schemaVersion: "rag.financeos.io/v1" });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents/:id — single document detail (from DB)
// ─────────────────────────────────────────────────────────────────────────────

router.get("/rag/documents/:id", async (req, res, next) => {
  try {
    const doc = await findDocumentById(req.params["id"]!);
    if (!doc) {
      res
        .status(404)
        .json({ error: "not_found", message: "Document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rag/documents/:id/chunks — chunks for a document (from rag_chunks)
// ─────────────────────────────────────────────────────────────────────────────

const ChunksQuerySchema = z.object({
  contentType: z
    .enum([
      "narrative",
      "table",
      "list",
      "header",
      "footer",
      "caption",
      "footnote",
      "title_page",
      "signature_block",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

router.get("/rag/documents/:id/chunks", async (req, res, next) => {
  const parsed = ChunksQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const docId = req.params["id"]!;

  try {
    // Verify the document exists first
    const doc = await findDocumentById(docId);
    if (!doc) {
      res
        .status(404)
        .json({ error: "not_found", message: "Document not found" });
      return;
    }

    const { contentType, limit, offset } = parsed.data;
    const result = await getChunksByDocumentId(docId, {
      contentType,
      limit,
      offset,
    });

    res.json({
      documentId: docId,
      data: result.data,
      total: result.total,
      tableChunks: result.tableChunks,
      narrativeChunks: result.narrativeChunks,
      avgTokenCount: result.avgTokenCount,
      limit,
      offset,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rag/ingest — simulate ingestion pipeline for a mock document
// ─────────────────────────────────────────────────────────────────────────────

const IngestBodySchema = z.object({
  documentId: z.string(),
  simulate: z.boolean().default(true),
});

router.post("/rag/ingest", async (req, res) => {
  const parsed = IngestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const doc = RAG_DOCUMENTS.find((d) => d.id === parsed.data.documentId);
  if (!doc) {
    res
      .status(404)
      .json({ error: "not_found", message: "Document not found in mock fixtures" });
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
    res
      .status(400)
      .json({ error: "bad_request", message: parsed.error.message });
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
  const liveVectorStore = !container.isStub("vectorStore");

  res.json({
    vectorStore: {
      supported: ["pinecone", "qdrant", "pgvector", "weaviate", "opensearch", "in_memory"],
      active: liveVectorStore ? "pgvector" : DEFAULT_MOCK_PROVIDER_CONFIG.vectorStore.provider,
      live: liveVectorStore,
    },
    embedding: {
      supported: ["openai", "cohere", "bedrock", "mock"],
      active: USE_BEDROCK ? "bedrock" : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.provider,
      model: USE_BEDROCK
        ? EMBEDDING_MODEL
        : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.model,
      dimensions: USE_BEDROCK ? 1024 : DEFAULT_MOCK_PROVIDER_CONFIG.embedding.dimensions,
      live: USE_BEDROCK,
    },
    reranker: {
      supported: ["cohere", "bge", "cross_encoder", "mock"],
      active: DEFAULT_MOCK_PROVIDER_CONFIG.reranker?.provider ?? null,
    },
    parser: {
      supported: ["unstructured", "tika", "pdfplumber", "llamaparse", "pdf-parse", "mammoth"],
      active: "pdf-parse / mammoth",
      live: true,
    },
  });
});

export default router;
