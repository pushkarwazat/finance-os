import { randomUUID } from "node:crypto";
import type {
  RetrievalRequest,
  ScoredChunk,
  RetrievalResult,
} from "./contracts.js";
import type { DocumentAnswer } from "../citations/schema.js";
import { MOCK_CHUNKS } from "../fixtures/chunks.js";
import { MOCK_DOCUMENTS_MAP } from "../fixtures/documents.js";
import { DOCUMENT_TYPE_META } from "../documents/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic keyword scorer (BM25-like cosine approximation)
// ─────────────────────────────────────────────────────────────────────────────

function keywordScore(query: string, text: string): number {
  const qTokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const textTokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  if (qTokens.size === 0 || textTokens.length === 0) return 0;
  let hits = 0;
  for (const token of textTokens) {
    if (qTokens.has(token)) hits++;
  }
  return Math.min(1, (hits / textTokens.length) * 10);
}

// Deterministic dense score (seeded by content hash, not random)
function denseScore(queryText: string, chunkText: string): number {
  const q = queryText.toLowerCase();
  const t = chunkText.toLowerCase();
  const commonWords = ["the", "is", "a", "of", "in", "and", "to", "for"];
  const qWords = q.split(/\W+/).filter((w) => w.length > 2 && !commonWords.includes(w));
  let score = 0;
  for (const word of qWords) {
    if (t.includes(word)) score += 0.15;
  }
  return Math.min(0.99, Math.max(0.1, score + 0.35));
}

function rerankScore(query: string, chunk: ScoredChunk): number {
  const text = (chunk.chunk as { chunkText: string }).chunkText ?? "";
  const base = keywordScore(query, text) * 0.4 + (chunk.hybridScore ?? chunk.denseScore ?? 0) * 0.6;
  // Tables get a bonus when query mentions numbers/percentages
  const isNumericQuery = /\d|%|margin|revenue|arr|mrr|ratio|rate/.test(query.toLowerCase());
  const isTable = (chunk.chunk as { contentType: string }).contentType === "table";
  return Math.min(1, base + (isNumericQuery && isTable ? 0.15 : 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock retrieval pipeline
// ─────────────────────────────────────────────────────────────────────────────

export function mockRetrieve(request: RetrievalRequest): DocumentAnswer {
  const start = Date.now();
  const { question, filters } = request;

  // Filter chunks by tenant and metadata
  let candidates = MOCK_CHUNKS.filter((c) => {
    if (c.tenantId !== filters.tenantId) return false;
    if (filters.documentIds?.length && !filters.documentIds.includes(c.documentId)) return false;
    if (filters.tablesOnly && c.contentType !== "table") return false;
    if (filters.excludeTables && c.contentType === "table") return false;
    if (filters.requiredTags?.length) {
      return filters.requiredTags.every((t) => c.metadataTags.includes(t));
    }
    return true;
  });

  // Score each candidate
  const scored: ScoredChunk[] = candidates.map((chunk) => {
    const ds = denseScore(question, chunk.chunkText);
    const ks = keywordScore(question, chunk.chunkText);
    const alpha = request.hybrid?.alpha ?? 0.6;
    const hs = alpha * ds + (1 - alpha) * ks;
    return {
      chunk,
      denseScore: ds,
      keywordScore: ks,
      hybridScore: hs,
      finalScore: hs,
    };
  });

  // Sort by hybrid score
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const topK = request.hybrid?.dense.topK ?? 20;
  const preRerank = scored.slice(0, topK);

  // Mock rerank
  const rerankK = request.rerank?.topK ?? 5;
  const reranked = preRerank
    .map((sc) => ({ ...sc, rerankScore: rerankScore(question, sc), finalScore: rerankScore(question, sc) }))
    .sort((a, b) => b.rerankScore! - a.rerankScore!)
    .slice(0, rerankK);

  const retrievalLatency = Math.round((Date.now() - start) * 1.5 + 12);

  // Assemble citations
  const maxCitations = request.citation?.maxCitations ?? 5;
  const minScore = request.citation?.minScore ?? 0.4;
  const maxExcerpt = request.citation?.maxExcerptLength ?? 500;

  const now = new Date().toISOString();
  const citations = reranked
    .filter((sc) => sc.finalScore >= minScore)
    .slice(0, maxCitations)
    .map((sc, i) => {
      const chunk = sc.chunk as (typeof MOCK_CHUNKS)[number];
      const doc = MOCK_DOCUMENTS_MAP[chunk.documentId];
      const excerpt = chunk.chunkText.substring(0, maxExcerpt);
      const docType = doc ? DOCUMENT_TYPE_META[doc.type]?.label ?? doc.type : "document";
      return {
        citationId: randomUUID(),
        citationNumber: i + 1,
        documentId: chunk.documentId,
        chunkId: chunk.chunkId,
        documentTitle: doc?.title ?? "Unknown Document",
        documentType: docType,
        fiscalYear: doc?.fiscalYear,
        period: doc?.period,
        sectionTitle: chunk.sectionTitle,
        sectionPath: chunk.sectionPath,
        pageNumber: chunk.pageNumber,
        excerpt,
        excerptShort: excerpt.substring(0, 120) + (excerpt.length > 120 ? "…" : ""),
        isTable: chunk.contentType === "table",
        contentType: chunk.contentType,
        denseScore: sc.denseScore,
        keywordScore: sc.keywordScore,
        hybridScore: sc.hybridScore,
        rerankScore: sc.rerankScore,
        finalScore: sc.finalScore,
        sensitivityLevel: chunk.sensitivityLevel,
        sensitivityTags: chunk.sensitivityTags,
        retrievalMode: "hybrid" as const,
        assembledAt: now,
      };
    });

  // Overall confidence from top citation
  const topScore = citations[0]?.finalScore ?? 0;
  const confidence = Math.min(1, topScore * (citations.length > 1 ? 1.1 : 0.9));
  const confidenceTier =
    confidence >= 0.7 ? ("high" as const) :
    confidence >= 0.45 ? ("medium" as const) :
    confidence >= 0.25 ? ("low" as const) :
    ("insufficient" as const);

  // Generate answer
  const abstain = citations.length === 0 || confidence < 0.2;
  let answerText: string | null = null;

  if (!abstain) {
    const topCitation = citations[0]!;
    const sourceRef = `[${topCitation.documentTitle}, p.${topCitation.pageNumber ?? "–"}]`;
    answerText = citations[0]!.isTable
      ? `Based on the financial data in ${sourceRef}: ${topCitation.excerptShort}`
      : `According to ${sourceRef}: "${topCitation.excerptShort}" ${citations.length > 1 ? `(+${citations.length - 1} additional sources)` : ""}`;
  }

  return {
    answerId: randomUUID(),
    question,
    normalisedQuestion: question.toLowerCase().trim(),
    answerText,
    abstained: abstain,
    abstentionReason: abstain ? "insufficient_evidence" : undefined,
    abstentionMessage: abstain ? "I could not find sufficient evidence in the document knowledge base to answer this question confidently." : undefined,
    confidence,
    confidenceTier,
    citations,
    documentsSearched: new Set(candidates.map((c) => c.documentId)).size,
    chunksRetrieved: preRerank.length,
    chunksReranked: reranked.length,
    retrievalMode: "hybrid",
    embeddingModel: "mock-embedding-v1",
    rerankModel: "mock-rerank-v1",
    retrievalLatencyMs: retrievalLatency,
    totalLatencyMs: retrievalLatency + 5,
    createdAt: now,
    schemaVersion: "rag.financeos.io/v1",
  };
}
