import { Router } from "express";
import { randomUUID } from "crypto";
import { SubmitQuestionBody, ListAskSessionsQueryParams } from "@workspace/api-zod";
import { MOCK_DOCUMENTS } from "../data/fixtures.js";

const router = Router();

const MOCK_SESSION_ID = "a0000000-0000-0000-0000-000000000001";

const MOCK_QA_STORE: Record<string, { question: string; answer: string; citations: unknown[] }> = {
  revenue: {
    question: "What drove the revenue miss in Q4?",
    answer:
      "Q4 revenue came in at $94.2M, $4.2M below the $98.4M budget. The primary drivers were (1) delayed enterprise contract renewals slipping into Q1 FY2026, accounting for -$3.1M, and (2) lower professional services volume as customers shifted to self-service onboarding, accounting for -$1.1M. ARR, however, exceeded budget at $312M vs. $305M planned, suggesting the core subscription business is healthy.",
    citations: [
      {
        id: randomUUID(),
        documentId: MOCK_DOCUMENTS[3].id,
        documentTitle: MOCK_DOCUMENTS[3].title,
        chunkIndex: 4,
        pageNumber: 3,
        excerpt:
          "Q4 revenue variance of -$4.2M was primarily attributable to three large enterprise renewals that were deferred to Q1 FY2026 due to extended procurement timelines.",
        relevanceScore: 0.96,
        queryId: randomUUID(),
      },
    ],
  },
  audit: {
    question: "What did the external audit find?",
    answer:
      "The FY2025 Q4 external audit by Deloitte found no material weaknesses. One significant deficiency was identified related to the timing of revenue recognition controls — specifically, the review process for end-of-period contract modifications needs to be strengthened. Management has committed to remediation by Q2 FY2026.",
    citations: [
      {
        id: randomUUID(),
        documentId: MOCK_DOCUMENTS[0].id,
        documentTitle: MOCK_DOCUMENTS[0].title,
        chunkIndex: 12,
        pageNumber: 34,
        excerpt:
          "We identified one significant deficiency related to controls over the review and approval of revenue recognition adjustments for contracts modified within 30 days of period end.",
        relevanceScore: 0.98,
        queryId: randomUUID(),
      },
    ],
  },
};

router.post("/ask", (req, res) => {
  const parsed = SubmitQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { question, sessionId } = parsed.data;
  const q = question.toLowerCase();
  let answer = "Based on the available financial data, this question requires additional context from the document corpus. Please refine your query or upload relevant financial documents for analysis.";
  let citations: unknown[] = [];

  if (q.includes("revenue") || q.includes("miss") || q.includes("variance")) {
    answer = MOCK_QA_STORE.revenue.answer;
    citations = MOCK_QA_STORE.revenue.citations;
  } else if (q.includes("audit") || q.includes("weakness") || q.includes("deficiency")) {
    answer = MOCK_QA_STORE.audit.answer;
    citations = MOCK_QA_STORE.audit.citations;
  } else if (q.includes("margin") || q.includes("ebitda")) {
    answer = "Gross margin declined 80bps to 67.3% in Q4, primarily driven by increased cloud infrastructure costs related to AI model serving. EBITDA margin compressed to 16.7% from 18.5%, a 180bps decline, reflecting the revenue shortfall flowing through with only partial offset from the Q3 restructuring savings of $1.3M.";
  } else if (q.includes("close") || q.includes("task") || q.includes("checklist")) {
    answer = "Three close tasks remain open for Q4 FY2025: Intercompany Reconciliation (in progress, assigned to Sarah Chen, due Feb 3), Revenue Recognition Review (in review, due Feb 5), and Tax Provision Calculation (pending, due Feb 7). Two critical tasks — Bank Reconciliation and Fixed Asset Depreciation Roll — have been completed.";
  }

  const responseSessionId = sessionId ?? MOCK_SESSION_ID;
  const messageId = randomUUID();
  const queryId = randomUUID();
  const updatedCitations = (citations as Array<Record<string, unknown>>).map((c) => ({
    ...c,
    id: randomUUID(),
    queryId,
  }));

  res.json({
    sessionId: responseSessionId,
    messageId,
    question,
    answer,
    citations: updatedCitations,
    agentId: "a0000000-0000-0000-0000-000000000099",
    latencyMs: Math.floor(Math.random() * 800) + 400,
    tokens: Math.floor(answer.length / 3),
    createdAt: new Date().toISOString(),
  });
});

router.get("/ask/sessions", (req, res) => {
  const parsed = ListAskSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const now = new Date().toISOString();
  const sessions = [
    {
      id: MOCK_SESSION_ID,
      title: "Q4 Revenue Variance Analysis",
      messageCount: 6,
      createdAt: "2025-02-01T14:00:00Z",
      updatedAt: "2025-02-01T14:45:00Z",
    },
    {
      id: "a0000000-0000-0000-0000-000000000002",
      title: "Audit Report Findings",
      messageCount: 3,
      createdAt: "2025-01-22T10:30:00Z",
      updatedAt: "2025-01-22T11:00:00Z",
    },
    {
      id: "a0000000-0000-0000-0000-000000000003",
      title: "Close Checklist Status",
      messageCount: 2,
      createdAt: "2025-02-02T09:00:00Z",
      updatedAt: "2025-02-02T09:15:00Z",
    },
  ];
  res.json({ data: sessions.slice(0, parsed.data.limit ?? 20), total: sessions.length });
});

export default router;
