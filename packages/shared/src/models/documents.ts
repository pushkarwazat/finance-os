import { z } from "zod";

export const DocumentStatusSchema = z.enum([
  "uploading",
  "processing",
  "indexed",
  "failed",
  "archived",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const DocumentTypeSchema = z.enum([
  "financial_statement",
  "audit_report",
  "board_deck",
  "budget_model",
  "variance_commentary",
  "policy",
  "contract",
  "other",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  type: DocumentTypeSchema,
  status: DocumentStatusSchema,
  tags: z.array(z.string()).default([]),
  uploadedBy: z.string().uuid(),
  uploaderName: z.string(),
  chunkCount: z.number().int().default(0),
  pageCount: z.number().int().optional(),
  summary: z.string().optional(),
  fiscalYear: z.number().int().optional(),
  period: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Document = z.infer<typeof DocumentSchema>;

export const CitationSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  documentTitle: z.string(),
  chunkIndex: z.number().int(),
  pageNumber: z.number().int().optional(),
  excerpt: z.string(),
  relevanceScore: z.number().min(0).max(1),
  queryId: z.string().uuid(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const DocumentStatsSchema = z.object({
  total: z.number().int(),
  byType: z.record(DocumentTypeSchema, z.number().int()),
  byStatus: z.record(DocumentStatusSchema, z.number().int()),
  totalSizeBytes: z.number().int(),
  totalChunks: z.number().int(),
});
export type DocumentStats = z.infer<typeof DocumentStatsSchema>;
