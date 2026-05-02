import { Router } from "express";
import {
  ListDocumentsQueryParams,
  GetDocumentParams,
} from "@workspace/api-zod";
import { MOCK_DOCUMENTS } from "../data/fixtures.js";

const router = Router();

router.get("/documents", (req, res) => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { type, status, search, limit = 30, offset = 0 } = parsed.data;
  let filtered = MOCK_DOCUMENTS;
  if (type) filtered = filtered.filter((d) => d.type === type);
  if (status) filtered = filtered.filter((d) => d.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (d) =>
        d.title.toLowerCase().includes(s) ||
        d.filename.toLowerCase().includes(s) ||
        d.tags.some((t: string) => t.toLowerCase().includes(s))
    );
  }
  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);
  res.json({ data, total, limit, offset });
});

router.get("/documents/stats", (_req, res) => {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalSizeBytes = 0;
  let totalChunks = 0;
  for (const d of MOCK_DOCUMENTS) {
    byType[d.type] = (byType[d.type] ?? 0) + 1;
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    totalSizeBytes += d.sizeBytes;
    totalChunks += d.chunkCount;
  }
  res.json({
    total: MOCK_DOCUMENTS.length,
    byType,
    byStatus,
    totalSizeBytes,
    totalChunks,
  });
});

router.get("/documents/:id", (req, res) => {
  const parsed = GetDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const doc = MOCK_DOCUMENTS.find((d) => d.id === parsed.data.id);
  if (!doc) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Document not found" });
    return;
  }
  res.json(doc);
});

export default router;
