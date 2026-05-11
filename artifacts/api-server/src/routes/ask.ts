import { Router } from "express";
import { randomUUID } from "crypto";
import { SubmitQuestionBody, ListAskSessionsQueryParams } from "@workspace/api-zod";
import { MOCK_DOCUMENTS } from "../data/fixtures.js";
import { BedrockLlmAdapter } from "@financeos/adapters";
import { retrievePassages, formatPassagesForPrompt } from "../lib/rag-retriever.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// LLM provider — instantiated once at startup
// ─────────────────────────────────────────────────────────────────────────────

const useBedrock =
  process.env.LLM_PROVIDER === "bedrock" &&
  process.env.AWS_REGION !== undefined;

const bedrockAdapter = useBedrock ? new BedrockLlmAdapter() : null;

// ─────────────────────────────────────────────────────────────────────────────
// In-memory session store
// ─────────────────────────────────────────────────────────────────────────────

interface SessionTurn {
  role: "user" | "assistant";
  content: string;
}

interface Session {
  id: string;
  title: string;
  turns: SessionTurn[];
  createdAt: string;
  updatedAt: string;
}

const MAX_CONTEXT_TURNS = 10; // 5 user + 5 assistant messages kept for context

const sessionStore = new Map<string, Session>();

function getOrCreateSession(sessionId: string | undefined): Session {
  if (sessionId && sessionStore.has(sessionId)) {
    return sessionStore.get(sessionId)!;
  }
  const id = sessionId ?? randomUUID();
  const session: Session = {
    id,
    title: "",
    turns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessionStore.set(id, session);
  return session;
}

function appendTurns(session: Session, userContent: string, assistantContent: string) {
  session.turns.push({ role: "user", content: userContent });
  session.turns.push({ role: "assistant", content: assistantContent });
  // Auto-title from first question
  if (!session.title) {
    session.title = userContent.length > 72
      ? userContent.slice(0, 69) + "…"
      : userContent;
  }
  // Trim to keep only the most recent MAX_CONTEXT_TURNS
  if (session.turns.length > MAX_CONTEXT_TURNS) {
    session.turns = session.turns.slice(session.turns.length - MAX_CONTEXT_TURNS);
  }
  session.updatedAt = new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt — base context for all finance Q&A
// ─────────────────────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are FinanceOS, an AI finance analyst assistant for a public company's finance team.
You help with financial metrics, variance analysis, close management, budgets, forecasts, revenue recognition, audit findings, governance, and compliance.
Answer questions precisely and analytically. When retrieved_documents are provided, ground your answer in those passages and cite specific numbers from them.
Flag material risks, anomalies, or control gaps when you identify them.
If a question is outside the finance domain, politely redirect to the appropriate team.
Today's fiscal context: Q3 FY2025. Company: enterprise SaaS. ARR ~$312M.

When you have retrieved document passages, structure your response as follows:
1. Lead with the direct answer citing specific numbers from the documents
2. Explain key drivers or context
3. Flag any risks or anomalies you observe
4. Note any data limitations or caveats

You have access to conversation history. Use it to understand follow-up questions and build on prior answers without repeating yourself unnecessarily.`;

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

function getMockAnswer(
  question: string,
  priorTurns: SessionTurn[],
): { answer: string; citations: unknown[] } {
  const q = question.toLowerCase();
  const isFollowUp = priorTurns.length > 0;

  if (q.includes("revenue") || q.includes("miss") || q.includes("variance")) {
    return {
      ...MOCK_QA_STORE.revenue,
      answer: isFollowUp
        ? "Building on the prior context — " + MOCK_QA_STORE.revenue.answer
        : MOCK_QA_STORE.revenue.answer,
    };
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

  const { question, sessionId: requestedSessionId } = parsed.data;
  const session = getOrCreateSession(requestedSessionId ?? undefined);
  const messageId = randomUUID();
  const startMs = Date.now();

  const priorTurns = session.turns.slice(); // snapshot before appending

  let answer: string;
  let citations: unknown[] = [];

  if (bedrockAdapter) {
    // ── 1. RAG retrieval — embed + pgvector search ────────────────────────
    let ragResult;
    try {
      ragResult = await retrievePassages(question, {
        topK: 5,
        minScore: 0.1,
        requestId: res.locals.requestId,
      });

      if (ragResult.passages.length > 0) {
        req.log.info(
          {
            passageCount: ragResult.passages.length,
            embeddingLatencyMs: ragResult.embeddingLatencyMs,
            searchLatencyMs: ragResult.searchLatencyMs,
            topScore: ragResult.passages[0]?.relevanceScore,
            priorTurns: priorTurns.length,
            sessionId: session.id,
          },
          "RAG retrieval",
        );
      }

      citations = ragResult.passages;
    } catch (err) {
      req.log.warn({ err }, "RAG retrieval failed — proceeding without grounding");
      ragResult = { passages: [], embeddingLatencyMs: 0, searchLatencyMs: 0, embeddingModel: "", vectorCount: 0 };
    }

    // ── 2. Build grounded system prompt + conversation history ────────────
    const documentsBlock = formatPassagesForPrompt(ragResult.passages);
    const systemPrompt = BASE_SYSTEM_PROMPT + documentsBlock;

    // Messages: system → prior turns → new user question
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...priorTurns.map((t) => ({ role: t.role as "user" | "assistant", content: t.content })),
      { role: "user", content: question },
    ];

    // ── 3. Claude completion ──────────────────────────────────────────────
    try {
      const completion = await bedrockAdapter.complete({
        model: process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-5-sonnet-20241022-v2:0",
        messages,
        maxTokens: 1_500,
        temperature: 0.1,
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
          ragPassages: ragResult.passages.length,
          priorTurns: priorTurns.length,
          grounded: ragResult.passages.length > 0,
          sessionId: session.id,
        },
        "Bedrock completion",
      );
    } catch (err) {
      return next(err);
    }
  } else {
    // ── Mock fallback ─────────────────────────────────────────────────────
    const mock = getMockAnswer(question, priorTurns);
    answer = mock.answer;
    citations = (mock.citations as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      id: randomUUID(),
    }));
  }

  // ── Persist turn to session ───────────────────────────────────────────────
  appendTurns(session, question, answer);

  res.json({
    sessionId: session.id,
    messageId,
    question,
    answer,
    citations,
    agentId: "a0000000-0000-0000-0000-000000000099",
    latencyMs: Date.now() - startMs,
    tokens: Math.ceil(answer.length / 4),
    turnIndex: session.turns.length / 2, // exchange number (1-based)
    createdAt: new Date().toISOString(),
  });
});

router.get("/ask/sessions", (req, res) => {
  const parsed = ListAskSessionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }

  const limit = parsed.data.limit ?? 20;

  // Return live sessions first (newest first), then fill with seeded examples if few
  const liveSessions = Array.from(sessionStore.values())
    .filter((s) => s.title) // only sessions with at least one exchange
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: s.turns.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

  res.json({ data: liveSessions, total: liveSessions.length });
});

export default router;
