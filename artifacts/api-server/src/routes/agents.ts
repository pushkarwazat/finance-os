import { Router } from "express";
import { ListAgentSessionsQueryParams, ListAgentSessionsParams } from "@workspace/api-zod";

const router = Router();

const MOCK_AGENTS = [
  {
    id: "a0000000-0000-0000-0000-000000000099",
    name: "FinanceOS Analyst Agent",
    description:
      "Primary AI analyst for metric interpretation, variance explanation, and document-grounded Q&A.",
    capabilities: [
      "metric_analysis",
      "variance_explanation",
      "document_qa",
      "forecast_commentary",
    ],
    status: "idle" as const,
    version: "1.0.2",
    modelId: "gpt-4o",
    embeddingModelId: "text-embedding-3-large",
    contextWindowTokens: 128_000,
    lastHeartbeatAt: new Date(Date.now() - 30_000).toISOString(),
  },
  {
    id: "a0000000-0000-0000-0000-000000000098",
    name: "Close Copilot Agent",
    description: "Specialized agent for financial close workflow guidance and checklist management.",
    capabilities: ["close_assistance", "governance_review"],
    status: "idle" as const,
    version: "0.9.1",
    modelId: "claude-3-5-sonnet-20241022",
    contextWindowTokens: 200_000,
    lastHeartbeatAt: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: "a0000000-0000-0000-0000-000000000097",
    name: "Eval Harness Agent",
    description: "Automated benchmark runner and LLM-as-judge scorer for agent evaluation suites.",
    capabilities: ["benchmark_evaluation"],
    status: "idle" as const,
    version: "1.1.0",
    modelId: "gpt-4o",
    contextWindowTokens: 128_000,
    lastHeartbeatAt: new Date(Date.now() - 600_000).toISOString(),
  },
];

const MOCK_SESSIONS_BY_AGENT: Record<string, unknown[]> = {
  "a0000000-0000-0000-0000-000000000099": [
    {
      id: "a0000000-0000-0000-0000-000000000001",
      agentId: "a0000000-0000-0000-0000-000000000099",
      title: "Q4 Loss Ratio Variance — Actuarial Reserve Release",
      messageCount: 6,
      createdAt: "2025-02-01T14:00:00Z",
      updatedAt: "2025-02-01T14:45:00Z",
    },
    {
      id: "a0000000-0000-0000-0000-000000000002",
      agentId: "a0000000-0000-0000-0000-000000000099",
      title: "PBM Reimbursement Rate Impact on Pharmacy Margin",
      messageCount: 4,
      createdAt: "2025-01-22T10:30:00Z",
      updatedAt: "2025-01-22T11:00:00Z",
    },
  ],
};

router.get("/agents", (_req, res) => {
  res.json({ data: MOCK_AGENTS, total: MOCK_AGENTS.length });
});

router.get("/agents/:id/sessions", (req, res) => {
  const pathParsed = ListAgentSessionsParams.safeParse(req.params);
  const queryParsed = ListAgentSessionsQueryParams.safeParse(req.query);
  if (!pathParsed.success || !queryParsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const sessions = MOCK_SESSIONS_BY_AGENT[pathParsed.data.id] ?? [];
  const limit = queryParsed.data.limit ?? 20;
  res.json({ data: sessions.slice(0, limit), total: sessions.length });
});

export default router;
