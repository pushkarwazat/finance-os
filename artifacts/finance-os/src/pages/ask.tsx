import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  MessageSquare, Send, Bot, User, Loader2, Info, AlertTriangle,
  AlertCircle, ChevronDown, ChevronRight, Database, FlaskConical,
  Layers, GitBranch, ShieldAlert, CheckCircle2, SlidersHorizontal,
  Sparkles, BookOpen,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MetricRef {
  slug: string; label: string; domain: string
  matchType: string; resolutionConfidence: number; formula?: string
}
interface MockDataPoint {
  label: string; value: number | string | null; formattedValue?: string
  timestamp?: string; variance?: number; isFavorable?: boolean
}
interface Assumption {
  key: string; description: string; category: string
  confidence: number; assumedValue: string; overridable: boolean
}
interface Caveat { key: string; description: string; severity: "info" | "warning" | "critical"; referenceSlug?: string }
interface PipelineStep {
  step: string; status: "ok" | "skipped" | "warned" | "failed"
  detail: string; elapsedMs: number; output?: Record<string, unknown>
}
interface QueryPlan {
  metrics: MetricRef[]; groupBy: string[]; filters: unknown[]
  timeRange?: { start: string; end: string; label?: string }
  limit?: number; sortDirection?: string; seriesGranularity?: string
}
interface AnalyticsResponse {
  traceId: string; sessionId: string; messageId: string; createdAt: string
  rawQuestion: string; intent: string; confidence: number
  confidenceTier: "high" | "medium" | "low"
  answerText: string; queryPlan?: QueryPlan; mockData?: MockDataPoint[]
  sourceMetrics: MetricRef[]; assumptions: Assumption[]; caveats: Caveat[]
  clarificationRequired?: { message: string; dimensions: unknown[] }
  abstained: boolean; abstentionReason?: string; abstentionMessage?: string
  pipelineTrace: PipelineStep[]; latencyMs: number
}
interface ChatMessage {
  id: string; role: "user" | "assistant"; content: string; response?: AnalyticsResponse
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL
const apiUrl = (path: string) => `${BASE}api${path}`

const INTENT_CONFIG: Record<string, { label: string; color: string }> = {
  metric_lookup:          { label: "Metric Lookup",  color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  trend_analysis:         { label: "Trend",          color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  variance_analysis:      { label: "Variance",       color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  comparison:             { label: "Comparison",     color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  ranking:                { label: "Ranking",        color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cohort_question:        { label: "Cohort",         color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" },
  clarification_required: { label: "Clarification", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  unsupported_request:    { label: "Unsupported",   color: "bg-red-500/10 text-red-500 border-red-500/20" },
}

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  high:   { label: "High confidence",   color: "text-emerald-500" },
  medium: { label: "Medium confidence", color: "text-amber-500" },
  low:    { label: "Low confidence",    color: "text-red-500" },
}

const STEP_ICONS: Record<string, React.ElementType> = {
  receive: MessageSquare, normalise: SlidersHorizontal,
  classify_intent: Layers, extract_entities: Database,
  resolve_metrics: BookOpen, build_query_plan: GitBranch,
  check_abstention: ShieldAlert, check_guardrails: CheckCircle2,
  fetch_mock_data: FlaskConical, format_answer: Sparkles,
  build_response: CheckCircle2,
}

const SUGGESTED_PROMPTS = [
  "What is our current ARR?",
  "How has gross margin trended over the last 6 months?",
  "Why did we miss the Q3 revenue budget?",
  "Compare EMEA vs APAC revenue for Q3.",
  "Top 10 customers by ARR.",
  "Write me a SQL query to get revenue.",
]

// ─────────────────────────────────────────────────────────────────────────────
// ConfidenceBar
// ─────────────────────────────────────────────────────────────────────────────

function ConfidenceBar({ value, tier }: { value: number; tier: string }) {
  const pct = Math.round(value * 100)
  const color =
    tier === "high" ? "bg-emerald-500" : tier === "medium" ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("text-xs font-medium tabular-nums", TIER_CONFIG[tier]?.color)}>{pct}%</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DataTable
// ─────────────────────────────────────────────────────────────────────────────

function DataTable({ points }: { points: MockDataPoint[] }) {
  const hasVariance = points.some((p) => p.variance !== undefined)
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Label</th>
            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Value</th>
            {hasVariance && (
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Variance</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {points.map((pt, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{pt.label}</td>
              <td className="px-3 py-2 text-right font-mono">
                {pt.formattedValue ?? String(pt.value)}
              </td>
              {hasVariance && (
                <td
                  className={cn(
                    "px-3 py-2 text-right font-mono",
                    pt.variance !== undefined
                      ? pt.isFavorable
                        ? "text-emerald-500"
                        : "text-red-500"
                      : ""
                  )}
                >
                  {pt.variance !== undefined
                    ? `${pt.isFavorable ? "▲" : "▼"} ${Math.abs(pt.variance).toLocaleString()}`
                    : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Inspector
// ─────────────────────────────────────────────────────────────────────────────

function PipelineInspector({ response }: { response: AnalyticsResponse }) {
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set())

  const toggleStep = (step: string) =>
    setOpenSteps((prev) => {
      const next = new Set(prev)
      next.has(step) ? next.delete(step) : next.add(step)
      return next
    })

  const intent = INTENT_CONFIG[response.intent]
  const tier = TIER_CONFIG[response.confidenceTier]

  return (
    <div className="space-y-4 text-sm">
      {/* Intent + confidence */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Intent
          </span>
          <Badge variant="outline" className={cn("text-[10px] px-2", intent?.color)}>
            {intent?.label ?? response.intent}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tier?.label}</span>
            <span className="font-mono">{response.latencyMs}ms</span>
          </div>
          <ConfidenceBar value={response.confidence} tier={response.confidenceTier} />
        </div>
      </div>

      {/* Abstention */}
      {response.abstained && (
        <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-red-500 font-medium text-xs">
            <ShieldAlert className="h-3.5 w-3.5" />
            Abstained — {response.abstentionReason?.replace(/_/g, " ")}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {response.abstentionMessage}
          </p>
        </div>
      )}

      {/* Source metrics */}
      {response.sourceMetrics.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Source Metrics
          </span>
          {response.sourceMetrics.map((m) => (
            <div key={m.slug} className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium text-xs">{m.label}</span>
                <div className="flex gap-1.5 mt-0.5">
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    {m.domain}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {m.matchType}
                  </Badge>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-mono",
                  m.resolutionConfidence > 0.8 ? "text-emerald-500" : "text-amber-500"
                )}
              >
                {Math.round(m.resolutionConfidence * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Query plan */}
      {response.queryPlan && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Query Plan
          </span>
          <div className="rounded-md bg-muted/40 border border-border divide-y divide-border text-xs">
            {response.queryPlan.timeRange && (
              <div className="px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">
                  {response.queryPlan.timeRange.label ??
                    `${response.queryPlan.timeRange.start} → ${response.queryPlan.timeRange.end}`}
                </span>
              </div>
            )}
            {(response.queryPlan.groupBy?.length ?? 0) > 0 && (
              <div className="px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Group by</span>
                <span className="font-mono">{response.queryPlan.groupBy.join(", ")}</span>
              </div>
            )}
            {response.queryPlan.limit && (
              <div className="px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Limit</span>
                <span className="font-mono">TOP {response.queryPlan.limit}</span>
              </div>
            )}
            {response.queryPlan.seriesGranularity && (
              <div className="px-3 py-2 flex justify-between">
                <span className="text-muted-foreground">Granularity</span>
                <span className="font-mono">{response.queryPlan.seriesGranularity}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {response.assumptions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Assumptions
          </span>
          {response.assumptions.map((a) => (
            <div key={a.key} className="flex items-start gap-2 text-xs">
              <Info className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
              <span className="text-muted-foreground leading-relaxed">{a.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Caveats */}
      {response.caveats.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Caveats
          </span>
          {response.caveats.map((c) => (
            <div key={c.key} className="flex items-start gap-2 text-xs">
              {c.severity === "critical" ? (
                <AlertCircle className="h-3 w-3 mt-0.5 text-red-500 shrink-0" />
              ) : c.severity === "warning" ? (
                <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
              ) : (
                <Info className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-muted-foreground leading-relaxed">{c.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline trace */}
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline Trace
        </span>
        {response.pipelineTrace.map((step) => {
          const Icon = STEP_ICONS[step.step] ?? CheckCircle2
          const open = openSteps.has(step.step)
          const statusColor =
            step.status === "ok"
              ? "text-emerald-500"
              : step.status === "warned"
              ? "text-amber-500"
              : step.status === "skipped"
              ? "text-muted-foreground"
              : "text-red-500"
          return (
            <div key={step.step} className="rounded border border-border overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-muted/40 transition-colors"
                onClick={() => toggleStep(step.step)}
              >
                <Icon className={cn("h-3 w-3 shrink-0", statusColor)} />
                <span className="flex-1 text-xs font-mono">{step.step}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {step.elapsedMs}ms
                </span>
                {open ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
              {open && (
                <div className="px-2.5 py-2 bg-muted/30 border-t border-border space-y-1">
                  <p className="text-[10px] text-muted-foreground">{step.detail}</p>
                  {step.output && (
                    <pre className="overflow-auto max-h-28 text-[9px] font-mono bg-background/50 rounded p-1.5">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Trace ID */}
      <div className="pt-1 border-t border-border">
        <p className="text-[10px] text-muted-foreground font-mono break-all">
          trace: {response.traceId}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Assistant message bubble
// ─────────────────────────────────────────────────────────────────────────────

function AssistantBubble({
  msg,
  isActive,
  onSelect,
}: {
  msg: ChatMessage
  isActive: boolean
  onSelect: () => void
}) {
  const resp = msg.response
  const hasData = (resp?.mockData?.length ?? 0) > 0
  const [tab, setTab] = useState<"answer" | "data">("answer")

  const renderText = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      )
    )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start"
    >
      <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center text-primary flex-shrink-0 mt-1">
        <Bot className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Badges */}
        {resp && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn("text-[10px] px-2 py-0.5", INTENT_CONFIG[resp.intent]?.color)}
            >
              {INTENT_CONFIG[resp.intent]?.label ?? resp.intent}
            </Badge>
            {resp.abstained && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-500 border-red-500/20"
              >
                <ShieldAlert className="h-2.5 w-2.5 mr-1" />
                Abstained
              </Badge>
            )}
            {resp.assumptions?.length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-500 border-blue-500/20"
              >
                <Info className="h-2.5 w-2.5 mr-1" />
                {resp.assumptions.length} assumption{resp.assumptions.length > 1 ? "s" : ""}
              </Badge>
            )}
            {resp.caveats?.length > 0 && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0.5",
                  resp.caveats.some((c) => c.severity === "critical")
                    ? "bg-red-500/10 text-red-500 border-red-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                )}
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {resp.caveats.length} caveat{resp.caveats.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "bg-muted rounded-2xl rounded-tl-sm px-4 py-3 cursor-pointer transition-all",
            isActive && "ring-1 ring-primary/40"
          )}
          onClick={onSelect}
        >
          {hasData ? (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "answer" | "data")}>
              <TabsList className="mb-3 h-7">
                <TabsTrigger value="answer" className="text-xs h-6">
                  Answer
                </TabsTrigger>
                <TabsTrigger value="data" className="text-xs h-6">
                  Data ({resp!.mockData!.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="answer">
                <p className="text-sm leading-relaxed">{renderText(msg.content)}</p>
              </TabsContent>
              <TabsContent value="data">
                <DataTable points={resp!.mockData!} />
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-sm leading-relaxed">{renderText(msg.content)}</p>
          )}
        </div>

        {resp && (
          <p className="text-[10px] text-muted-foreground px-1">
            {Math.round(resp.confidence * 100)}% confidence · {resp.latencyMs}ms
            {isActive ? " · Inspector active →" : " · Click to inspect pipeline"}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AskPage
// ─────────────────────────────────────────────────────────────────────────────

export function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello. Ask any finance question — I'll classify the intent, build a semantic query plan, check abstention policy, and return a fully traceable answer. Click any response to inspect the pipeline.",
    },
  ])
  const [input, setInput] = useState("")
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"inspector" | "examples">("inspector")
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeResponse = messages.find((m) => m.id === activeMessageId)?.response

  const { data: examplesData } = useQuery({
    queryKey: ["/api/analytics/examples", "sidebar"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/analytics/examples?limit=30"))
      if (!res.ok) throw new Error("Failed to fetch examples")
      return res.json() as Promise<{
        data: Array<{ id: string; prompt: string; expected: { intent: string; tags: string[] } }>
      }>
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (question: string): Promise<AnalyticsResponse> => {
      const res = await fetch(apiUrl("/analytics/answer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error("Request failed")
      return res.json()
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (question: string = input) => {
    if (!question.trim() || submitMutation.isPending) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    submitMutation.mutate(question, {
      onSuccess: (data) => {
        const content = data.abstained
          ? (data.abstentionMessage ?? "I'm unable to answer that request.")
          : data.clarificationRequired
          ? data.clarificationRequired.message
          : data.answerText
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content,
          response: data,
        }
        setMessages((prev) => [...prev, assistantMsg])
        setActiveMessageId(assistantMsg.id)
        setInspectorTab("inspector")
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", content: "An error occurred. Please try again." },
        ])
      },
    })
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 max-w-[1400px] mx-auto">
      {/* ── Chat panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-card border border-border rounded-xl overflow-hidden">
        <ScrollArea className="flex-1 p-5" ref={scrollRef}>
          <div className="space-y-5 max-w-2xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 justify-end"
                  >
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4" />
                    </div>
                  </motion.div>
                ) : (
                  <AssistantBubble
                    key={msg.id}
                    msg={msg}
                    isActive={msg.id === activeMessageId}
                    onSelect={() => {
                      setActiveMessageId(msg.id)
                      setInspectorTab("inspector")
                    }}
                  />
                )
              )}
              {submitMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center text-primary flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <div
                        key={d}
                        className="w-1.5 h-1.5 bg-current rounded-full animate-bounce"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Suggested prompts */}
        <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => handleSubmit(p)}
              disabled={submitMutation.isPending}
              className="flex-shrink-0 text-xs text-muted-foreground bg-muted/60 hover:bg-muted rounded-full px-3 py-1.5 transition-colors border border-border disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="p-4 border-t border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
            className="relative flex items-center"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a finance question…"
              className="pr-12 bg-background h-11 rounded-full"
              disabled={submitMutation.isPending}
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="absolute right-1 text-primary hover:bg-primary/10 rounded-full h-9 w-9"
              disabled={!input.trim() || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* ── Pipeline Inspector sidebar ──────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col flex-shrink-0 bg-card border border-border rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["inspector", "examples"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInspectorTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors",
                inspectorTab === t
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "inspector" ? (
                <>
                  <GitBranch className="h-3.5 w-3.5" />
                  Pipeline
                </>
              ) : (
                <>
                  <FlaskConical className="h-3.5 w-3.5" />
                  Examples
                </>
              )}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-4">
          {inspectorTab === "inspector" ? (
            activeResponse ? (
              <PipelineInspector response={activeResponse} />
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground">
                <GitBranch className="h-8 w-8 opacity-20" />
                <p className="text-sm font-medium">Pipeline Inspector</p>
                <p className="text-xs leading-relaxed">
                  Ask a question or click any assistant response to inspect its intent, query plan,
                  assumptions, caveats, and step-by-step pipeline trace.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground pb-1">
                {examplesData?.data.length ?? 0} example prompts with expected parsed outputs. Click
                to run any.
              </p>
              {(examplesData?.data ?? []).map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handleSubmit(ex.prompt)}
                  disabled={submitMutation.isPending}
                  className="w-full text-left rounded-md border border-border p-2.5 hover:bg-muted/40 transition-colors space-y-1 disabled:opacity-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs leading-relaxed text-foreground">{ex.prompt}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1 py-0 shrink-0 mt-0.5",
                        INTENT_CONFIG[ex.expected.intent]?.color
                      )}
                    >
                      {INTENT_CONFIG[ex.expected.intent]?.label ?? ex.expected.intent}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ex.expected.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="text-[9px] text-muted-foreground bg-muted rounded px-1"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
