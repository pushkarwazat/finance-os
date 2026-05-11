import { Router } from "express";
import { randomUUID } from "crypto";
import { SubmitQuestionBody, ListAskSessionsQueryParams } from "@workspace/api-zod";
import { MOCK_DOCUMENTS } from "../data/fixtures.js";
import { BedrockLlmAdapter } from "@financeos/adapters";

const router = Router();

const MOCK_SESSION_ID = "a0000000-0000-0000-0000-000000000001";

// ─────────────────────────────────────────────────────────────────────────────
// LLM provider — instantiated once at startup
// ─────────────────────────────────────────────────────────────────────────────

const useBedrock =
  process.env.LLM_PROVIDER === "bedrock" &&
  process.env.AWS_REGION !== undefined;

const bedrockAdapter = useBedrock ? new BedrockLlmAdapter() : null;

const FINANCE_SYSTEM_PROMPT = `You are FinanceOS, an AI finance analyst assistant for a public company's finance team.
You help with financial metrics, variance analysis, close management, budgets, forecasts, revenue recognition, audit findings, governance, and compliance.
Answer questions precisely and analytically. Cite specific numbers when available.
Flag material risks, anomalies, or control gaps when you identify them.
If a question is outside the finance domain, politely redirect to the appropriate team.
Today's fiscal context: Q3 FY2024. Company: enterprise SaaS. ARR ~$312M.`;

// ─────────────────────────────────────────────────────────────────────────────
// Mock fallback (used when LLM_PROVIDER is not set)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_QA_STORE: Record<string, { answer: string; citations: unknown[] }> = {
  revenue: {
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

function getMockAnswer(question: string): { answer: string; citations: unknown[] } {
  const q = question.toLowerCase();
  if (q.includes("revenue") || q.includes("miss") || q.includes("variance")) {
    return MOCK_QA_STORE.revenue;
  }
  if (q.includes("audit") || q.includes("weakness") || q.includes("deficiency")) {
    return MOCK_QA_STORE.audit;
  }
  if (q.includes("margin") || q.includes("ebitda")) {
    return {
      answer:
        "Gross margin declined 80bps to 67.3% in Q4, primarily driven by increased cloud infrastructure costs related to AI model serving. EBITDA margin compressed to 16.7% from 18.5%, a 180bps decline, reflecting the revenue shortfall flowing through with only partial offset from the Q3 restructuring savings of $1.3M.",
      citations: [],
    };
  }
  if (q.includes("close") || q.includes("task") || q.includes("checklist")) {
    return {
      answer:
        "Three close tasks remain open for Q4 FY2025: Intercompany Reconciliation (in progress, due Feb 3), Revenue Recognition Review (in review, due Feb 5), and Tax Provision Calculation (pending, due Feb 7). Bank Reconciliation and Fixed Asset Depreciation Roll are complete.",
      citations: [],
    };
  }
  return {
    answer:
      "Based on the available financial data, this question requires additional context from the document corpus. Please refine your query or connect a real data source for deeper analysis.",
    citations: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post("/ask", async (req, res, next) => {
  const parsed = SubmitQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }

  const { question, sessionId } = parsed.data;
  const responseSessionId = sessionId ?? MOCK_SESSION_ID;
  const queryId = randomUUID();
  const messageId = randomUUID();
  const startMs = Date.now();

  let answer: string;
  let citations: unknown[] = [];

  if (bedrockAdapter) {
    try {
      const completion = await bedrockAdapter.complete({
        model: process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0",
        messages: [
          { role: "system", content: FINANCE_SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        maxTokens: 1_024,
        temperature: 0.3,
        requestId: res.locals.requestId,
        traceId: res.locals.traceId,
      });

      answer = completion.choices[0]?.message.content ?? "No response from model.";
      req.log.info(
        {
          model: completion.model,
          promptTokens: completion.usage.promptTokens,
          completionTokens: completion.usage.completionTokens,
          latencyMs: completion.executionMs,
        },
        "Bedrock completion",
      );
    } catch (err) {
      return next(err);
    }
  } else {
    const mock = getMockAnswer(question);
    answer = mock.answer;
    citations = (mock.citations as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      id: randomUUID(),
      queryId,
    }));
  }

  res.json({
    sessionId: responseSessionId,
    messageId,
    question,
    answer,
    citations,
    agentId: "a0000000-0000-0000-0000-000000000099",
    latencyMs: Date.now() - startMs,
    tokens: Math.ceil(answer.length / 4),
    createdAt: new Date().toISOString(),
  });
});

router.get("/ask/sessions", (req, res) => {
  const parsed = ListAskSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
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
