import { Router } from "express";
import { randomUUID } from "crypto";
import { SubmitQuestionBody, ListAskSessionsQueryParams } from "@workspace/api-zod";
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

const BASE_SYSTEM_PROMPT = `You are FinanceOS, an AI finance analyst assistant for a dual-business holding company's finance team.
The company operates two segments: (1) an insurance brokerage writing ~$178M in Gross Written Premium across commercial property, liability, professional lines, and workers compensation; and (2) a direct-to-consumer pharmacy dispensing ~127,000 Rx/month with three major PBM relationships (CVS Caremark, Express Scripts, OptumRx).
You help with financial metrics, variance analysis, close management, budgets, forecasts, actuarial reserves, claims analysis, PBM reconciliations, regulatory filings, governance, and compliance.
Key insurance metrics: GWP, loss ratio, combined ratio, expense ratio, IBNR reserves, commission income, policy retention, CAT exposure.
Key pharmacy metrics: Rx volume, pharmacy gross margin, refill/adherence rate, DIR fees, generic dispensing rate, cost per Rx, PBM reimbursement rates.
Answer questions precisely and analytically. When retrieved_documents are provided, ground your answer in those passages and cite specific numbers from them.
Flag material risks, anomalies, or control gaps when you identify them — including reserve adequacy concerns, PBM rate changes, regulatory compliance gaps, and producer commission discrepancies.
If a question is outside the finance domain, politely redirect to the appropriate team.
Today's fiscal context: Q4 FY2025. Insurance segment GWP ~$178M. Pharmacy segment ~127K Rx/month.

When you have retrieved document passages, structure your response as follows:
1. Lead with the direct answer citing specific numbers from the documents
2. Explain key drivers or context (note which segment — insurance or pharmacy — is relevant)
3. Flag any risks or anomalies you observe
4. Note any data limitations or caveats

You have access to conversation history. Use it to understand follow-up questions and build on prior answers without repeating yourself unnecessarily.`;

// ─────────────────────────────────────────────────────────────────────────────
// Mock fallback (used when LLM_PROVIDER is not set)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_QA_STORE: Record<string, { answer: string; citations: unknown[] }> = {
  revenue: {
    answer:
      "Q4 consolidated revenue came in at $94.2M, $2.7M above the $91.5M budget. The insurance segment was the primary driver — Gross Written Premium reached $178.4M, beating budget by $6.4M, with commercial lines rate increases (+8–12%) and 14 new mid-market account wins contributing $17.2M of year-over-year growth. Commission income of $35.7M was $3.3M ahead of the prior year. The pharmacy segment grew Rx volume to 127,400 fills/month (+7.1% YoY) but pharmacy gross margin compressed to 18.3% from 19.7% due to PBM reimbursement rate reductions from two contract renegotiations in October.",
    citations: [],
  },
  audit: {
    answer:
      "The FY2025 Q4 actuarial reserve review found loss reserves to be adequate. The actuary recommended a 130bps reduction in the commercial liability IBNR development assumption (from 12% to 9.5%) based on updated industry loss triangles, releasing $2.1M of reserves. This adjustment is pending CFO and Controller dual approval. No material weaknesses were identified in the close process. One finding: the PBM remittance reconciliation workflow lacks automated exception flagging for DIR fee adjustments exceeding $10K — management has committed to implementing automated controls by Q2 FY2026.",
    citations: [],
  },
};

function getMockAnswer(
  question: string,
  priorTurns: SessionTurn[],
): { answer: string; citations: unknown[] } {
  const q = question.toLowerCase();
  const isFollowUp = priorTurns.length > 0;

  if (q.includes("revenue") || q.includes("premium") || q.includes("gwp") || q.includes("variance")) {
    return {
      ...MOCK_QA_STORE.revenue,
      answer: isFollowUp
        ? "Building on the prior context — " + MOCK_QA_STORE.revenue.answer
        : MOCK_QA_STORE.revenue.answer,
    };
  }
  if (q.includes("audit") || q.includes("reserve") || q.includes("ibnr") || q.includes("weakness") || q.includes("deficiency")) {
    return MOCK_QA_STORE.audit;
  }
  if (q.includes("loss ratio") || q.includes("combined ratio") || q.includes("underwriting")) {
    return {
      answer:
        "The Q4 loss ratio improved to 67.2% from 69.4% in the prior year — 130bps better than the 68.5% budget. The combined ratio came in at 94.8%, down from 96.2%, confirming underwriting profitability. The improvement was driven by the absence of CAT events (prior year had $12M in Hurricane Idalia tail settlements) and improved risk selection in the commercial liability book. The actuarial team is recommending a reserve release of $2.1M pending CFO/Controller approval.",
      citations: [],
    };
  }
  if (q.includes("pharmacy") || q.includes("rx") || q.includes("prescription") || q.includes("pbm") || q.includes("refill") || q.includes("margin")) {
    return {
      answer:
        "Pharmacy gross margin compressed to 18.3% in Q4 from 19.7%, a 140bps decline. PBM reimbursement rate reductions from two October renegotiations reduced margin by ~110bps ($0.42/brand fill, $0.18/generic fill). This was partially offset by a 250bps improvement in the generic dispensing rate to 84.2% — generics carry ~3x higher margin per fill. Rx volume grew 7.1% YoY to 127,400 monthly fills. The refill/adherence rate improved to 73.2% from 71.4%, indicating stronger patient retention.",
      citations: [],
    };
  }
  if (q.includes("close") || q.includes("task") || q.includes("checklist")) {
    return {
      answer:
        "Four close tasks remain open for Q4 FY2025: Carrier Premium Reconciliation (in progress, due Feb 3), Claims Reserves Adequacy Review (in review, awaiting actuarial sign-off, due Feb 5), PBM Remittance Reconciliation (in progress, due Feb 4), and State DOI Regulatory Filing (pending, due Feb 15). Producer Commission Payout Audit and Drug Inventory FIFO Roll are both complete.",
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
