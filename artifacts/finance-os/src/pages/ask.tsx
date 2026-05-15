import { useState, useRef, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Send, Bot, User, Loader2, ChevronDown, ChevronRight,
  BookOpen, FileText, Lock, Sparkles, AlertTriangle,
  PlusCircle, MessageSquare, RotateCcw, BarChart2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AskCitation {
  id: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  pageNumber: number | null
  excerpt: string
  relevanceScore: number
  queryId?: string
  sensitivityLevel?: string
}

interface ChartData {
  type: "bar" | "line" | "pie"
  title: string
  data: Array<Record<string, string | number | null>>
  xKey: string
  yKeys: string[]
}

interface AskResponse {
  sessionId: string | null
  messageId: string
  question: string
  answer: string
  citations: AskCitation[]
  chartData?: ChartData
  agentId: string
  latencyMs: number
  tokens: number
  turnIndex: number
  createdAt: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  askResponse?: AskResponse
  turnIndex?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL
const apiUrl = (path: string) => `${BASE}api${path}`

const SUGGESTED_PROMPTS = [
  "What was our gross margin and revenue performance in Q3 FY2025?",
  "Summarise the Q3 close memo — any risks?",
  "What were the key audit findings and remediation plans?",
  "What SOX controls are documented in the audit workpapers?",
  "Explain our revenue recognition policy under ASC 606.",
  "What was our ARR bridge for Q3?",
]

const SENSITIVITY_COLORS: Record<string, string> = {
  public:        "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  internal:      "bg-blue-500/10 text-blue-600 border-blue-500/20",
  confidential:  "bg-amber-500/10 text-amber-600 border-amber-500/20",
  restricted:    "bg-red-500/10 text-red-600 border-red-500/20",
  mnpi:          "bg-purple-500/10 text-purple-600 border-purple-500/20",
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown-lite renderer
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let listItems: string[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length) {
      nodes.push(
        <ul key={key++} className="list-disc pl-5 space-y-0.5 my-1.5">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      nodes.push(<div key={key++} className="h-1.5" />)
      continue
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushList()
      const content = trimmed.replace(/^#{1,3}\s/, "")
      nodes.push(
        <p key={key++} className="text-sm font-semibold text-foreground mt-3 mb-1 first:mt-0">
          <InlineText text={content} />
        </p>
      )
      continue
    }
    if (/^[-*•]\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*•]\s/, ""))
      continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s/, ""))
      continue
    }
    flushList()
    nodes.push(
      <p key={key++} className="text-sm leading-relaxed">
        <InlineText text={trimmed} />
      </p>
    )
  }
  flushList()
  return <div className="space-y-0.5">{nodes}</div>
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
        if (p.startsWith("*") && p.endsWith("*"))
          return <em key={i}>{p.slice(1, -1)}</em>
        return <span key={i}>{p}</span>
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Score bar
// ─────────────────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score >= 0.7 ? "bg-emerald-500" : score >= 0.45 ? "bg-amber-500" : "bg-muted-foreground"
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        "text-[10px] font-mono tabular-nums shrink-0",
        score >= 0.7 ? "text-emerald-500" : score >= 0.45 ? "text-amber-500" : "text-muted-foreground"
      )}>
        {pct}%
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Citation card
// ─────────────────────────────────────────────────────────────────────────────

function CitationCard({
  citation,
  index,
  compact = false,
}: {
  citation: AskCitation
  index: number
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const excerptLimit = compact ? 120 : 220
  const longExcerpt = citation.excerpt.length > excerptLimit
  const displayExcerpt = expanded || !longExcerpt
    ? citation.excerpt
    : citation.excerpt.slice(0, excerptLimit) + "…"

  const sensitivity = citation.sensitivityLevel ?? "internal"
  const sensitivityColor = SENSITIVITY_COLORS[sensitivity] ?? SENSITIVITY_COLORS.internal

  const docLabel = citation.documentTitle.startsWith("doc-")
    ? citation.documentTitle
        .replace("doc-", "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : citation.documentTitle

  return (
    <div className="rounded-lg border border-border bg-background/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        {/* Number badge */}
        <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
          {index}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-foreground leading-tight line-clamp-2">{docLabel}</p>
            <div className="flex items-center gap-1 shrink-0">
              {citation.pageNumber && (
                <span className="text-[10px] text-muted-foreground">p.{citation.pageNumber}</span>
              )}
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium border", sensitivityColor)}>
                <Lock className="h-2 w-2 mr-0.5" />
                {sensitivity}
              </Badge>
            </div>
          </div>
          <ScoreBar score={citation.relevanceScore} />
        </div>
      </div>

      {/* Excerpt */}
      <div className="px-3 pb-2.5 space-y-1.5">
        <div className="rounded bg-muted/40 px-2.5 py-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed font-mono">{displayExcerpt}</p>
        </div>
        {longExcerpt && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart panel
// ─────────────────────────────────────────────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#ef4444"]

function fmtValue(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
  return `$${v.toLocaleString()}`
}

function ChartPanel({ chartData }: { chartData: ChartData }) {
  const [open, setOpen] = useState(true)
  const { data, xKey, yKeys } = chartData

  return (
    <div className="mt-2 space-y-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <BarChart2 className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Chart</span>
        {open
          ? <ChevronDown className="h-3 w-3 group-hover:text-foreground" />
          : <ChevronRight className="h-3 w-3 group-hover:text-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-border bg-background/60 p-3">
              {chartData.type === "pie" ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey={yKeys[0]}
                      nameKey={xKey}
                      cx="50%"
                      cy="45%"
                      outerRadius={80}
                      label={({ name, percent }: { name: string; percent: number }) =>
                        `${String(name).length > 10 ? String(name).slice(0, 10) + "…" : name} ${(percent * 100).toFixed(1)}%`
                      }
                      labelLine={false}
                    >
                      {data.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmtValue(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Legend
                      iconSize={8}
                      wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey={xKey}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v: number) => fmtValue(v)}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value: number) => fmtValue(value)}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    {yKeys.map((yk, i) => (
                      <Bar key={yk} dataKey={yk} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]}>
                        {data.map((_, ri) => (
                          <Cell
                            key={ri}
                            fill={yKeys.length === 1
                              ? CHART_COLORS[ri % CHART_COLORS.length]
                              : CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sources panel (inline below answer)
// ─────────────────────────────────────────────────────────────────────────────

function SourcesPanel({ citations }: { citations: AskCitation[] }) {
  const [open, setOpen] = useState(true)
  if (!citations.length) return null
  return (
    <div className="mt-2 space-y-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">
          {citations.length} source{citations.length > 1 ? "s" : ""}
        </span>
        {open
          ? <ChevronDown className="h-3 w-3 group-hover:text-foreground" />
          : <ChevronRight className="h-3 w-3 group-hover:text-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 overflow-hidden"
          >
            {citations.map((c, i) => (
              <CitationCard key={c.id} citation={c} index={i + 1} compact />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sources inspector sidebar panel
// ─────────────────────────────────────────────────────────────────────────────

function SourcesInspector({ citations, latencyMs, tokens }: { citations: AskCitation[]; latencyMs: number; tokens: number }) {
  if (!citations.length) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground">
        <BookOpen className="h-8 w-8 opacity-20" />
        <p className="text-sm font-medium">No sources retrieved</p>
        <p className="text-xs leading-relaxed">
          No document passages matched this query above the relevance threshold.
        </p>
      </div>
    )
  }

  const topScore = citations[0]?.relevanceScore ?? 0
  const avgScore = citations.reduce((s, c) => s + c.relevanceScore, 0) / citations.length
  const uniqueDocs = new Set(citations.map((c) => c.documentId)).size

  return (
    <div className="space-y-4 text-sm">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Sources", value: citations.length },
          { label: "Documents", value: uniqueDocs },
          { label: "Latency", value: `${latencyMs}ms` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md bg-muted/40 border border-border px-2.5 py-2 text-center">
            <p className="text-xs font-semibold tabular-nums">{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Score summary */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Relevance
        </span>
        <div className="rounded-md bg-muted/40 border border-border divide-y divide-border text-xs">
          <div className="px-3 py-2 flex justify-between">
            <span className="text-muted-foreground">Top score</span>
            <span className="font-mono">{(topScore * 100).toFixed(1)}%</span>
          </div>
          <div className="px-3 py-2 flex justify-between">
            <span className="text-muted-foreground">Avg score</span>
            <span className="font-mono">{(avgScore * 100).toFixed(1)}%</span>
          </div>
          <div className="px-3 py-2 flex justify-between">
            <span className="text-muted-foreground">Tokens</span>
            <span className="font-mono">{tokens}</span>
          </div>
        </div>
      </div>

      {/* Full citation list */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Retrieved passages
        </span>
        {citations.map((c, i) => (
          <CitationCard key={c.id} citation={c} index={i + 1} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty inspector placeholder
// ─────────────────────────────────────────────────────────────────────────────

function InspectorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-muted-foreground">
      <Sparkles className="h-8 w-8 opacity-20" />
      <p className="text-sm font-medium">Grounded AI Inspector</p>
      <p className="text-xs leading-relaxed max-w-[220px]">
        Ask a question — Claude retrieves relevant document passages and grounds its answer in them.
        Click any response to inspect its sources.
      </p>
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
  const resp = msg.askResponse
  const hasCitations = (resp?.citations.length ?? 0) > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 justify-start"
    >
      <div className="w-8 h-8 rounded bg-primary/15 flex items-center justify-center text-primary flex-shrink-0 mt-1">
        <Bot className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Grounded badge */}
        {resp && (
          <div className="flex flex-wrap items-center gap-1.5">
            {hasCitations ? (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
              >
                <BookOpen className="h-2.5 w-2.5 mr-1" />
                Grounded · {resp.citations.length} source{resp.citations.length > 1 ? "s" : ""}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20"
              >
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                Ungrounded
              </Badge>
            )}
          </div>
        )}

        {/* Answer bubble */}
        <div
          className={cn(
            "bg-muted rounded-2xl rounded-tl-sm px-4 py-3 cursor-pointer transition-all",
            isActive && "ring-1 ring-primary/40"
          )}
          onClick={onSelect}
        >
          <MarkdownLite text={msg.content} />
        </div>

        {/* Chart */}
        {resp?.chartData && (
          <ChartPanel chartData={resp.chartData} />
        )}

        {/* Citations */}
        {resp && hasCitations && (
          <div className="pl-0">
            <SourcesPanel citations={resp.citations} />
          </div>
        )}

        {/* Footer */}
        {resp && (
          <p className="text-[10px] text-muted-foreground px-1 flex items-center gap-1.5">
            {resp.turnIndex > 1 && (
              <span className="inline-flex items-center gap-0.5 bg-muted rounded px-1 py-0.5">
                <MessageSquare className="h-2.5 w-2.5" />
                Turn {resp.turnIndex}
              </span>
            )}
            <span>{resp.latencyMs}ms · {resp.tokens} tokens</span>
            <span>{isActive ? "· Inspector active →" : "· Click to inspect sources"}</span>
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AskPage
// ─────────────────────────────────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello. Ask any finance question — I'll retrieve the most relevant passages from the document corpus and ground my answer in them. Each response includes numbered sources you can expand. Follow-up questions remember the full conversation context.",
}

export function AskPage() {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<"sources" | "sessions">("sources")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeMessage = messages.find((m) => m.id === activeMessageId)
  const activeResp = activeMessage?.askResponse
  const exchangeCount = messages.filter((m) => m.role === "user").length

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ["/api/ask/sessions"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/ask/sessions"))
      if (!res.ok) throw new Error("Failed to fetch sessions")
      return res.json() as Promise<{
        data: Array<{ id: string; title: string; messageCount: number; updatedAt: string }>
        total: number
      }>
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (question: string): Promise<AskResponse> => {
      const res = await fetch(apiUrl("/ask"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, ...(sessionId ? { sessionId } : {}) }),
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

  const handleNewConversation = () => {
    setMessages([WELCOME_MESSAGE])
    setSessionId(null)
    setActiveMessageId(null)
    setInput("")
    refetchSessions()
  }

  const handleSubmit = (question: string = input) => {
    if (!question.trim() || submitMutation.isPending) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: question }
    setMessages((prev) => [...prev, userMsg])
    setInput("")

    submitMutation.mutate(question, {
      onSuccess: (data) => {
        // Persist the session ID from the first response
        if (!sessionId && data.sessionId) setSessionId(data.sessionId)
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          askResponse: data,
          turnIndex: data.turnIndex,
        }
        setMessages((prev) => [...prev, assistantMsg])
        setActiveMessageId(assistantMsg.id)
        setInspectorTab("sources")
        // Refresh sessions list so the current conversation appears
        void queryClient.invalidateQueries({ queryKey: ["/api/ask/sessions"] })
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
        {/* Chat header — session indicator + new conversation */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            {sessionId ? (
              <span className="text-xs text-muted-foreground">
                Session active ·{" "}
                <span className="font-medium text-foreground">
                  {exchangeCount} exchange{exchangeCount !== 1 ? "s" : ""}
                </span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">New conversation</span>
            )}
          </div>
          {exchangeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleNewConversation}
              disabled={submitMutation.isPending}
            >
              <RotateCcw className="h-3 w-3" />
              New conversation
            </Button>
          )}
        </div>

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
                      setInspectorTab("sources")
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
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Retrieving relevant passages…
                    </div>
                    <div className="flex gap-1">
                      {[0, 150, 300].map((d) => (
                        <div
                          key={d}
                          className="w-1.5 h-1.5 bg-current rounded-full animate-bounce opacity-40"
                          style={{ animationDelay: `${d}ms` }}
                        />
                      ))}
                    </div>
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
              className="flex-shrink-0 text-xs text-muted-foreground bg-muted/60 hover:bg-muted rounded-full px-3 py-1.5 transition-colors border border-border disabled:opacity-50 max-w-[260px] truncate"
              title={p}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div className="p-4 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
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

      {/* ── Inspector sidebar ───────────────────────────────────────────── */}
      <div className="w-80 xl:w-96 flex flex-col flex-shrink-0 bg-card border border-border rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-border">
          {(["sources", "sessions"] as const).map((t) => (
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
              {t === "sources" ? (
                <>
                  <BookOpen className="h-3.5 w-3.5" />
                  Sources
                  {activeResp && activeResp.citations.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-primary/15 text-primary text-[10px] px-1.5 py-0 font-semibold">
                      {activeResp.citations.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Sessions
                  {(sessionsData?.data.length ?? 0) > 0 && (
                    <span className="ml-0.5 rounded-full bg-muted text-muted-foreground text-[10px] px-1.5 py-0 font-semibold">
                      {sessionsData!.data.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1 p-4">
          {inspectorTab === "sources" ? (
            activeResp ? (
              <SourcesInspector
                citations={activeResp.citations}
                latencyMs={activeResp.latencyMs}
                tokens={activeResp.tokens}
              />
            ) : (
              <InspectorEmpty />
            )
          ) : (
            <div className="space-y-3">
              {/* New conversation shortcut */}
              <button
                onClick={handleNewConversation}
                disabled={submitMutation.isPending}
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
              >
                <PlusCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                Start a new conversation
              </button>

              {/* Live sessions */}
              {(sessionsData?.data ?? []).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent sessions
                  </p>
                  {sessionsData!.data.map((s) => (
                    <Card
                      key={s.id}
                      className={cn(
                        "p-2.5 transition-colors cursor-default",
                        s.id === sessionId
                          ? "border-primary/40 bg-primary/5"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium leading-relaxed line-clamp-2">{s.title}</p>
                        <Badge
                          variant={s.id === sessionId ? "default" : "secondary"}
                          className="text-[9px] shrink-0"
                        >
                          {s.messageCount / 2 | 0} turn{(s.messageCount / 2 | 0) !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(s.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {s.id === sessionId && (
                          <span className="ml-1.5 text-primary font-medium">· active</span>
                        )}
                      </p>
                    </Card>
                  ))}
                </div>
              )}

              {(sessionsData?.data ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  No sessions yet — ask your first question.
                </p>
              )}

              {/* Suggested prompts */}
              <div className="pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Suggested questions
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handleSubmit(p)}
                      disabled={submitMutation.isPending}
                      className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted/40 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed text-foreground">{p}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}
