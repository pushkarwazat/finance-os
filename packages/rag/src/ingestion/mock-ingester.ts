import { randomUUID } from "node:crypto";
import type {
  DocumentIngestionPipeline,
  ParseResult,
  NormaliseResult,
  ClassifyResult,
  ChunkingConfig,
  EmbeddingConfig,
  IndexConfig,
  EnrichmentConfig,
  IngestionJob,
  IngestionPipelineConfig,
} from "./pipeline.js";
import { DEFAULT_INGESTION_CONFIG } from "./pipeline.js";
import type { FinanceDocument } from "../documents/schema.js";
import type { Chunk } from "../chunks/schema.js";
import { DOCUMENT_TYPE_META } from "../documents/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic mock sentence splitter
// ─────────────────────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock ingestion pipeline implementation
// ─────────────────────────────────────────────────────────────────────────────

export class MockDocumentIngestionPipeline implements DocumentIngestionPipeline {
  // ── Step 1: Parse ──────────────────────────────────────────────────────────

  async parse(documentId: string, _content: Buffer, mimeType: string): Promise<ParseResult> {
    const mockText = [
      `Executive Summary. This document covers the financial period ending September 30, 2025.`,
      `Revenue Performance. Total revenue for the quarter was $48.3M, representing 18% year-over-year growth.`,
      `ARR reached $195M at period end, up from $165M in the prior year. Net Revenue Retention was 118%.`,
      `Gross margin improved to 74.2%, compared to 71.8% in Q3 FY2024. Operating expenses totalled $38.1M.`,
      `Cash and cash equivalents at quarter end were $92.4M. Burn rate was $3.2M per month.`,
      `Key Risks. Foreign exchange headwinds impacted international revenue by approximately $1.2M.`,
      `Customer Concentration. Top 10 customers represent 31% of ARR.`,
      `Outlook. Management reaffirms FY2025 guidance of $200–205M ARR and 20% revenue growth.`,
    ].join(" ");

    const mockTables: Record<string, string> = {
      "Table 1 — Revenue Summary": `| Metric | Q3 FY2025 | Q3 FY2024 | Change |\n|--------|-----------|-----------|--------|\n| Total Revenue | $48.3M | $41.0M | +18% |\n| ARR | $195M | $165M | +18% |\n| Gross Margin | 74.2% | 71.8% | +240bps |`,
      "Table 2 — Cash Position": `| Item | Amount |\n|------|--------|\n| Cash & Equivalents | $92.4M |\n| Monthly Burn | $3.2M |\n| Runway | ~29 months |`,
    };

    return {
      text: mockText,
      pageCount: 12,
      mimeType,
      warnings: [],
      tables: mockTables,
    };
  }

  // ── Step 2: Normalise ──────────────────────────────────────────────────────

  async normalize(parseResult: ParseResult): Promise<NormaliseResult> {
    const normalisedText = parseResult.text
      .toLowerCase()
      .replace(/\s{2,}/g, " ")
      .trim();

    return {
      normalisedText,
      removedChars: parseResult.text.length - normalisedText.length,
      language: "en",
    };
  }

  // ── Step 3: Classify ───────────────────────────────────────────────────────

  async classify(document: FinanceDocument, _normalised: NormaliseResult): Promise<ClassifyResult> {
    const typeMeta = DOCUMENT_TYPE_META[document.type];
    return {
      inferredType: document.type,
      typeConfidence: 0.94,
      inferredSensitivity: typeMeta.defaultSensitivity,
      mnpiDetected: document.type === "board_deck" || document.type === "close_memo",
      piiDetected: false,
    };
  }

  // ── Step 4: Chunk ──────────────────────────────────────────────────────────

  async chunk(
    document: FinanceDocument,
    normalised: NormaliseResult,
    config: ChunkingConfig
  ): Promise<Chunk[]> {
    const now = new Date().toISOString();
    const chunks: Chunk[] = [];
    let index = 0;

    // Narrative chunks — split by sentence, group into target token windows
    const sentences = splitSentences(normalised.normalisedText);
    let buffer: string[] = [];
    let bufferTokens = 0;

    const flush = (sectionTitle: string, pageNumber: number) => {
      if (buffer.length === 0) return;
      const text = buffer.join(" ");
      chunks.push({
        chunkId: randomUUID(),
        documentId: document.id,
        tenantId: document.tenantId,
        chunkIndex: index++,
        contentType: "narrative",
        sectionTitle,
        sectionPath: [sectionTitle],
        chunkText: text,
        tokenCount: estimateTokenCount(text),
        pageNumber,
        metadataTags: document.tags,
        sensitivityLevel: document.sensitivityLevel,
        sensitivityTags: document.sensitivityTags,
        entities: [],
        relationships: [],
        createdAt: now,
        updatedAt: now,
        schemaVersion: "rag.financeos.io/v1",
      });
      buffer = [];
      bufferTokens = 0;
    };

    const sections = [
      "Executive Summary",
      "Revenue Performance",
      "Key Risks",
      "Outlook",
    ];
    let sectionIndex = 0;
    let pageNumber = 1;

    for (const sentence of sentences) {
      const tokens = estimateTokenCount(sentence);
      if (bufferTokens + tokens > config.targetTokens && buffer.length > 0) {
        flush(sections[sectionIndex % sections.length]!, pageNumber);
        sectionIndex++;
        pageNumber = Math.min(12, pageNumber + 1);
      }
      buffer.push(sentence);
      bufferTokens += tokens;
    }
    flush(sections[sectionIndex % sections.length]!, pageNumber);

    // Table chunks — one per extracted table
    if (config.isolateTables) {
      const parseResult = await this.parse(document.id, Buffer.alloc(0), document.mimeType);
      for (const [label, markdown] of Object.entries(parseResult.tables)) {
        chunks.push({
          chunkId: randomUUID(),
          documentId: document.id,
          tenantId: document.tenantId,
          chunkIndex: index++,
          contentType: "table",
          sectionTitle: label,
          sectionPath: [label],
          chunkText: markdown,
          tokenCount: estimateTokenCount(markdown),
          pageNumber: Math.ceil(index / 2),
          tableReference: {
            tableLabel: label,
            headers: ["Metric", "Value"],
            rowCount: 3,
            markdownTable: markdown,
            hasFinancialData: true,
            currencies: ["USD"],
          },
          metadataTags: [...document.tags, "table", "financial_data"],
          sensitivityLevel: document.sensitivityLevel,
          sensitivityTags: document.sensitivityTags,
          entities: [],
          relationships: [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: "rag.financeos.io/v1",
        });
      }
    }

    return chunks;
  }

  // ── Step 5: Embed ──────────────────────────────────────────────────────────

  async embed(chunks: Chunk[], config: EmbeddingConfig): Promise<Chunk[]> {
    return chunks.map((chunk) => ({
      ...chunk,
      embedding: Array.from({ length: config.dimensions }, () =>
        Math.round((Math.random() * 2 - 1) * 10000) / 10000
      ),
      embeddingModel: config.model,
      embeddingDimensions: config.dimensions,
    }));
  }

  // ── Step 6: Index ──────────────────────────────────────────────────────────

  async index(_chunks: Chunk[], _config: IndexConfig): Promise<{ indexedCount: number }> {
    return { indexedCount: _chunks.length };
  }

  // ── Step 7: Enrich ─────────────────────────────────────────────────────────

  async enrich(chunks: Chunk[], _config: EnrichmentConfig): Promise<Chunk[]> {
    return chunks.map((chunk) => ({
      ...chunk,
      entities:
        chunk.contentType === "narrative"
          ? [
              { text: "Q3 FY2025", type: "date" as const, confidence: 0.97 },
              { text: "$195M", type: "amount" as const, confidence: 0.95 },
              { text: "ARR", type: "metric" as const, confidence: 0.99 },
            ]
          : [
              { text: "ARR", type: "metric" as const, confidence: 0.99 },
              { text: "Gross Margin", type: "metric" as const, confidence: 0.98 },
            ],
    }));
  }

  // ── Full pipeline run ──────────────────────────────────────────────────────

  async run(
    document: FinanceDocument,
    content: Buffer,
    overrides?: Partial<IngestionPipelineConfig>
  ): Promise<IngestionJob> {
    const config: IngestionPipelineConfig = {
      chunking: overrides?.chunking ?? DEFAULT_INGESTION_CONFIG.chunking,
      embedding: overrides?.embedding ?? DEFAULT_INGESTION_CONFIG.embedding,
      index: overrides?.index ?? DEFAULT_INGESTION_CONFIG.index,
      enrichment: overrides?.enrichment ?? DEFAULT_INGESTION_CONFIG.enrichment,
    };

    const jobId = randomUUID();
    const startedAt = new Date().toISOString();
    const steps = [];

    const t = (ms: number) => ms;
    let chunks: Chunk[] = [];

    // parse
    const parseResult = await this.parse(document.id, content, document.mimeType);
    steps.push({ step: "parse" as const, status: "ok" as const, detail: `${parseResult.pageCount} pages, ${Object.keys(parseResult.tables).length} tables`, outputCount: 1, elapsedMs: t(52), warnings: [], errors: [] });

    // normalize
    const normalised = await this.normalize(parseResult);
    steps.push({ step: "normalize" as const, status: "ok" as const, detail: `Removed ${normalised.removedChars} noise chars. Language: ${normalised.language}`, outputCount: 1, elapsedMs: t(8), warnings: [], errors: [] });

    // classify
    const classified = await this.classify(document, normalised);
    steps.push({ step: "classify" as const, status: "ok" as const, detail: `Type: ${classified.inferredType} (${Math.round(classified.typeConfidence * 100)}%). Sensitivity: ${classified.inferredSensitivity}`, outputCount: 1, elapsedMs: t(24), warnings: classified.mnpiDetected ? ["MNPI indicators detected"] : [], errors: [] });

    // chunk
    chunks = await this.chunk(document, normalised, config.chunking);
    const tableChunks = chunks.filter((c) => c.contentType === "table").length;
    steps.push({ step: "chunk" as const, status: "ok" as const, detail: `${chunks.length} chunks (${tableChunks} table, ${chunks.length - tableChunks} narrative)`, outputCount: chunks.length, elapsedMs: t(18), warnings: [], errors: [] });

    // embed
    chunks = await this.embed(chunks, config.embedding);
    steps.push({ step: "embed" as const, status: "ok" as const, detail: `${chunks.length} vectors × ${config.embedding.dimensions}d using ${config.embedding.model}`, outputCount: chunks.length, elapsedMs: t(chunks.length * 3), warnings: [], errors: [] });

    // index
    const { indexedCount } = await this.index(chunks, config.index);
    steps.push({ step: "index" as const, status: "ok" as const, detail: `Indexed ${indexedCount} chunks into '${config.index.collectionName}'`, outputCount: indexedCount, elapsedMs: t(35), warnings: [], errors: [] });

    // enrich
    chunks = await this.enrich(chunks, config.enrichment);
    steps.push({ step: "enrich" as const, status: "ok" as const, detail: `NER: ${chunks.reduce((a, c) => a + c.entities.length, 0)} entities extracted`, outputCount: chunks.length, elapsedMs: t(42), warnings: [], errors: [] });

    return {
      jobId,
      documentId: document.id,
      tenantId: document.tenantId,
      status: "done",
      pipeline: { chunkingConfig: config.chunking, embeddingConfig: config.embedding, indexConfig: config.index, enrichmentConfig: config.enrichment },
      steps,
      totalChunks: chunks.length,
      tableChunks,
      narrativeChunks: chunks.length - tableChunks,
      queuedAt: startedAt,
      startedAt,
      completedAt: new Date().toISOString(),
      retryCount: 0,
    };
  }
}

export const mockIngester = new MockDocumentIngestionPipeline();
