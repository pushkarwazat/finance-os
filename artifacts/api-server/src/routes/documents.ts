import { Router } from "express";
import {
  ListDocumentsQueryParams,
  GetDocumentParams,
} from "@workspace/api-zod";
import { container } from "@financeos/container";

const router = Router();

router.get("/documents", async (req, res, next) => {
  const parsed = ListDocumentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { type, status, search, limit = 30, offset = 0 } = parsed.data;

  if (container.isStub("vectorStore")) {
    res.json({ data: [], total: 0, limit, offset });
    return;
  }

  try {
    const result = await container.get("vectorStore").listDocuments({ type, status, search, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/documents/stats", async (_req, res, next) => {
  if (container.isStub("vectorStore")) {
    res.json({ total: 0, byType: {}, byStatus: {}, totalSizeBytes: 0, totalChunks: 0 });
    return;
  }

  try {
    const stats = await container.get("vectorStore").getDocumentStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get("/documents/:id", async (req, res, next) => {
  const parsed = GetDocumentParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }

  if (container.isStub("vectorStore")) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Document not found" });
    return;
  }

  try {
    const doc = await container.get("vectorStore").getDocumentById(parsed.data.id);
    if (!doc) {
      res.status(404).json({ error: "not_found", statusCode: 404, message: "Document not found" });
      return;
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
