import { useState, useRef, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import {
  FileText, Search, HardDrive, Filter, CheckCircle2, AlertCircle, RefreshCw,
  Clock, Shield, Table2, FileStack, Sparkles, ChevronRight, BookOpen,
  ArrowRight, BarChart3, Lock, Zap, X, ExternalLink, Eye, Database,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types (matching backend RAG schemas)
// ─────────────────────────────────────────────────────────────────────────────

interface RagDocument {
  id: string
  type: string
  title: string
  filename: string
  mimeType: string
  sizeBytes: number
  status: string
  uploadedAt: string
  uploadedBy: string
  tenantId: string
  sensitivityLevel: string
  tags: string[]
  sensitivityTags: string[]
  fiscalYear?: number
  period?: string
  pageCount?: number
  chunkCount: number
  summary?: string
  [key: string]: unknown
}

interface Citation {
  citationId: string
  citationNumber: number
  documentId: string
  chunkId: string
  documentTitle: string
  documentType: string
  fiscalYear?: number
  period?: string
  sectionTitle?: string
  pageNumber?: number
  excerpt: string
  excerptShort?: string
  isTable: boolean
  denseScore?: number
  hybridScore?: number
  rerankScore?: number
  finalScore: number
  sensitivityLevel: string
  sensitivityTags: string[]
  retrievalMode: string
}

interface DocumentAnswer {
  answerId: string
  question: string
  answerText: string | null
  abstained: boolean
  abstentionMessage?: string
  confidence: number
  confidenceTier: "high" | "medium" | "low" | "insufficient"
  citations: Citation[]
  documentsSearched: number
  chunksRetrieved: number
  chunksReranked: number
  retrievalMode: string
  retrievalLatencyMs: number
  totalLatencyMs: number
  createdAt: string
}

interface Chunk {
  chunkId: string
  documentId: string
  chunkIndex: number
  contentType: string
  sectionTitle?: string
  chunkText: string
  tokenCount: number
  pageNumber?: number
  metadataTags: string[]
  sensitivityLevel: string
  tableReference?: {
    tableLabel?: string
    headers: string[]
    rowCount: number
    markdownTable?: string
    hasFinancialData: boolean
  }
}

interface RagStatus {
  status: string
  indexedDocuments: number
  indexedChunks: number
  tableChunks: number
  capabilities: Record<string, boolean>
  providerConfig: Record<string, string>
  documentTypes: { type: string; label: string; description: string; defaultSensitivity: string }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/api"

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json() as Promise<T>
}

function useApiGet<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const d = await apiFetch<T>(path)
      setData(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [path])

  const [init, setInit] = useState(false)
  if (!init && path) { setInit(true); run() }

  return { data, loading, error, refetch: run }
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour helpers
// ─────────────────────────────────────────────────────────────────────────────

function typeColor(type: string) {
  const map: Record<string, string> = {
    contract:       "bg-blue-500/10 text-blue-500 border-blue-500/20",
    invoice:        "bg-orange-500/10 text-orange-500 border-orange-500/20",
    policy_doc:     "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    close_memo:     "bg-purple-500/10 text-purple-500 border-purple-500/20",
    board_deck:     "bg-red-500/10 text-red-500 border-red-500/20",
    audit_workpaper:"bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    sop:            "bg-sky-500/10 text-sky-500 border-sky-500/20",
  }
  return map[type] ?? "bg-muted text-muted-foreground border-muted"
}

function sensitivityColor(level: string) {
  const map: Record<string, string> = {
    public:       "bg-green-500/10 text-green-600 border-green-500/20",
    internal:     "bg-blue-500/10 text-blue-500 border-blue-500/20",
    confidential: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    restricted:   "bg-red-500/10 text-red-500 border-red-500/20",
  }
  return map[level] ?? "bg-muted text-muted-foreground border-muted"
}

function confidenceColor(tier: string) {
  if (tier === "high") return "text-green-500"
  if (tier === "medium") return "text-yellow-500"
  if (tier === "low") return "text-orange-500"
  return "text-muted-foreground"
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    contract: "Contract", invoice: "Invoice", policy_doc: "Policy",
    close_memo: "Close Memo", board_deck: "Board Deck",
    audit_workpaper: "Audit WP", sop: "SOP",
  }
  return map[type] ?? type.replace(/_/g, " ")
}

function statusIcon(status: string) {
  if (status === "indexed") return <CheckCircle2 className="h-3 w-3 text-green-500" />
  if (status === "processing" || status === "embedding") return <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />
  if (status === "error") return <AlertCircle className="h-3 w-3 text-red-500" />
  return <Clock className="h-3 w-3 text-muted-foreground" />
}

function formatKB(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function formatPct(n: number) {
  return `${Math.round(n * 100)}%`
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown table renderer
// ─────────────────────────────────────────────────────────────────────────────

function MarkdownTable({ markdown }: { markdown: string }) {
  const rows = markdown.split("\n").filter(r => r.trim() && !r.match(/^\|[-| ]+\|$/))
  const parsed = rows.map(r =>
    r.split("|").map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1)
  )
  if (parsed.length < 2) return <pre className="text-xs font-mono whitespace-pre-wrap">{markdown}</pre>
  const [header, ...body] = parsed
  return (
    <div className="overflow-x-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>{header!.map((h, i) => <th key={i} className="px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i} className={cn("border-t border-border", i % 2 === 1 && "bg-muted/20")}>
              {row.map((cell, j) => <td key={j} className="px-3 py-2 font-mono whitespace-nowrap">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Citation card
// ─────────────────────────────────────────────────────────────────────────────

function CitationCard({ citation, onDocClick }: { citation: Citation; onDocClick: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <div className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
          "bg-primary/10 text-primary"
        )}>
          {citation.citationNumber}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 font-medium h-4", typeColor(citation.documentType.toLowerCase().replace(/ /g, "_")))}>
              {citation.documentType}
            </Badge>
            {citation.isTable && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-indigo-500/10 text-indigo-500 border-indigo-500/20 gap-1 flex items-center">
                <Table2 className="h-2.5 w-2.5" /> Table
              </Badge>
            )}
            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4", sensitivityColor(citation.sensitivityLevel))}>
              <Lock className="h-2.5 w-2.5 mr-0.5" />{citation.sensitivityLevel}
            </Badge>
          </div>
          <button
            className="text-xs font-medium text-left hover:text-primary transition-colors line-clamp-1 w-full"
            onClick={() => onDocClick(citation.documentId)}
          >
            {citation.documentTitle}
            {citation.fiscalYear && <span className="text-muted-foreground ml-1">· FY{citation.fiscalYear}</span>}
          </button>
          {citation.sectionTitle && (
            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">§ {citation.sectionTitle}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={cn("text-xs font-semibold tabular-nums", confidenceColor(citation.finalScore >= 0.7 ? "high" : citation.finalScore >= 0.45 ? "medium" : "low"))}>
            {formatPct(citation.finalScore)}
          </span>
          {citation.pageNumber && (
            <span className="text-[10px] text-muted-foreground">p.{citation.pageNumber}</span>
          )}
        </div>
      </div>

      <div className={cn(
        "px-3 pb-3 border-t border-border/60 pt-2.5 bg-muted/20",
        !expanded && "max-h-20 overflow-hidden relative"
      )}>
        {citation.isTable && citation.excerptShort ? (
          expanded
            ? <MarkdownTable markdown={citation.excerpt} />
            : <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed line-clamp-3">{citation.excerptShort}</pre>
        ) : (
          <p className={cn("text-xs text-muted-foreground leading-relaxed italic", !expanded && "line-clamp-3")}>
            "{expanded ? citation.excerpt : citation.excerptShort ?? citation.excerpt}"
          </p>
        )}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/20 to-transparent" />
        )}
      </div>

      <button
        className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1.5 border-t border-border/40 flex items-center justify-center gap-1 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? "Collapse" : "Show full excerpt"}
        <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG search panel
// ─────────────────────────────────────────────────────────────────────────────

const SUGGESTED = [
  "What was ARR at end of Q3 FY2025?",
  "What adjustments were posted during Q3 close?",
  "How is subscription revenue recognised under ASC 606?",
  "What SOX ITGC findings were identified?",
  "What is the approval threshold for journal entries?",
  "Break down operating expenses for Q3 FY2025",
]

function RagSearchPanel({ onDocClick }: { onDocClick: (id: string) => void }) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<DocumentAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tablesOnly, setTablesOnly] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const result = await apiFetch<DocumentAnswer>("/rag/search", {
        method: "POST",
        body: JSON.stringify({ question: q, tablesOnly }),
      })
      setAnswer(result)
    } catch (e) {
      setError("Search failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    search(question)
  }

  const handleSuggestion = (q: string) => {
    setQuestion(q)
    search(q)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
          <Input
            ref={inputRef}
            placeholder="Ask a question about your documents…"
            className="pl-9 pr-4"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !question.trim()} size="sm" className="gap-1.5 px-4">
          {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Filter:</span>
        <button
          onClick={() => setTablesOnly(t => !t)}
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1",
            tablesOnly
              ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/30"
              : "bg-muted/50 text-muted-foreground border-muted hover:border-border"
          )}
        >
          <Table2 className="h-3 w-3" /> Tables only
        </button>
      </div>

      {!answer && !loading && !error && (
        <div>
          <p className="text-xs text-muted-foreground mb-3">Suggested questions:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SUGGESTED.map((q) => (
              <button
                key={q}
                onClick={() => handleSuggestion(q)}
                className="text-left text-xs p-3 rounded-lg border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all group flex items-start gap-2"
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {answer && (
        <div className="space-y-4">
          {/* Answer summary bar */}
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/60">
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5" />
                {answer.documentsSearched} docs · {answer.chunksRetrieved} chunks → {answer.chunksReranked} reranked
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                {answer.totalLatencyMs}ms
              </span>
              <span className="capitalize px-1.5 py-0.5 rounded bg-muted text-foreground/70">
                {answer.retrievalMode}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className={cn("text-xs font-semibold", confidenceColor(answer.confidenceTier))}>
                {formatPct(answer.confidence)} confidence
              </div>
              <div className={cn(
                "h-1.5 w-16 rounded-full bg-muted overflow-hidden"
              )}>
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    answer.confidenceTier === "high" ? "bg-green-500" :
                    answer.confidenceTier === "medium" ? "bg-yellow-500" :
                    answer.confidenceTier === "low" ? "bg-orange-500" : "bg-muted-foreground"
                  )}
                  style={{ width: formatPct(answer.confidence) }}
                />
              </div>
            </div>
          </div>

          {/* Abstention */}
          {answer.abstained && (
            <div className="flex gap-3 p-4 rounded-lg border border-muted bg-muted/30">
              <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium mb-1">Insufficient evidence</p>
                <p className="text-sm text-muted-foreground">{answer.abstentionMessage}</p>
              </div>
            </div>
          )}

          {/* Answer text */}
          {answer.answerText && (
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Answer</span>
              </div>
              <p className="text-sm leading-relaxed">{answer.answerText}</p>
            </div>
          )}

          {/* Citations */}
          {answer.citations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">
                  {answer.citations.length} Source{answer.citations.length !== 1 ? "s" : ""}
                </h4>
              </div>
              <div className="space-y-2.5">
                {answer.citations.map(c => (
                  <CitationCard key={c.citationId} citation={c} onDocClick={onDocClick} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Document grid card
// ─────────────────────────────────────────────────────────────────────────────

function DocCard({ doc, onClick }: { doc: RagDocument; onClick: () => void }) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0 font-medium", typeColor(doc.type))}>
            {typeLabel(doc.type)}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            {statusIcon(doc.status)}
            <span className="capitalize">{doc.status}</span>
          </div>
        </div>

        <h3 className="font-semibold text-sm line-clamp-2 mb-1 leading-snug" title={doc.title}>
          {doc.title}
        </h3>

        <div className="flex items-center gap-1.5 mt-2 mb-3">
          <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 flex items-center gap-0.5", sensitivityColor(doc.sensitivityLevel))}>
            <Lock className="h-2.5 w-2.5" />{doc.sensitivityLevel}
          </Badge>
          {doc.sensitivityTags.slice(0, 2).map(t => (
            <span key={t} className="text-[9px] bg-muted/60 text-muted-foreground px-1 py-0.5 rounded">{t}</span>
          ))}
        </div>

        <div className="text-xs text-muted-foreground space-y-1.5">
          {(doc.period || doc.fiscalYear) && (
            <div className="flex justify-between">
              <span>Period</span>
              <span className="font-medium text-foreground">{[doc.period, doc.fiscalYear ? `FY${doc.fiscalYear}` : ""].filter(Boolean).join(" ")}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Chunks</span>
            <span className="font-medium text-foreground flex items-center gap-1">
              <FileStack className="h-3 w-3" />
              {doc.chunkCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Size</span>
            <span className="font-medium text-foreground">{formatKB(doc.sizeBytes)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunk list in evidence inspector
// ─────────────────────────────────────────────────────────────────────────────

function ChunkList({ docId }: { docId: string }) {
  const [filter, setFilter] = useState<"all" | "narrative" | "table">("all")
  const { data, loading, error } = useApiGet<{ data: Chunk[]; total: number; tableChunks: number; narrativeChunks: number }>(
    `/rag/documents/${docId}/chunks`
  )

  const chunks = (data?.data ?? []).filter(c =>
    filter === "all" || c.contentType === filter
  )

  if (loading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
  if (error) return <p className="text-sm text-destructive">Failed to load chunks.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 text-xs">
          {(["all", "narrative", "table"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 rounded-md capitalize transition-colors",
                filter === f ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              )}>
              {f}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-[11px] text-muted-foreground">
            {data.tableChunks} table · {data.narrativeChunks} narrative
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {chunks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No chunks available.</p>
        ) : chunks.map((chunk, i) => (
          <div key={chunk.chunkId} className={cn(
            "p-3 rounded-lg border text-xs",
            chunk.contentType === "table"
              ? "border-indigo-500/20 bg-indigo-500/5"
              : "border-border bg-muted/20"
          )}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-muted-foreground font-mono">#{chunk.chunkIndex}</span>
              <Badge variant="outline" className={cn(
                "text-[9px] px-1 py-0 h-4",
                chunk.contentType === "table" ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "bg-muted"
              )}>
                {chunk.contentType === "table" ? <><Table2 className="h-2.5 w-2.5 mr-0.5" />table</> : chunk.contentType}
              </Badge>
              {chunk.sectionTitle && (
                <span className="text-muted-foreground truncate">§ {chunk.sectionTitle}</span>
              )}
              <span className="ml-auto text-muted-foreground shrink-0">{chunk.tokenCount} tok</span>
            </div>
            {chunk.contentType === "table" && chunk.tableReference?.markdownTable ? (
              <MarkdownTable markdown={chunk.tableReference.markdownTable} />
            ) : (
              <p className="text-muted-foreground leading-relaxed line-clamp-3">{chunk.chunkText}</p>
            )}
            {chunk.metadataTags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {chunk.metadataTags.slice(0, 5).map(t => (
                  <span key={t} className="bg-muted text-muted-foreground px-1 py-0.5 rounded text-[9px]">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Evidence inspector (right-side sheet)
// ─────────────────────────────────────────────────────────────────────────────

function EvidenceInspector({
  doc,
  onClose,
}: {
  doc: RagDocument
  onClose: () => void
}) {
  const [tab, setTab] = useState("overview")

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-border shrink-0">
        <div className="flex items-start gap-2 mb-3">
          <Badge variant="outline" className={cn("capitalize text-[10px]", typeColor(doc.type))}>
            {typeLabel(doc.type)}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] flex items-center gap-0.5", sensitivityColor(doc.sensitivityLevel))}>
            <Lock className="h-2.5 w-2.5" />{doc.sensitivityLevel}
          </Badge>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="font-semibold text-sm leading-snug mb-1">{doc.title}</h3>
        <p className="text-xs text-muted-foreground">{doc.filename}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {[
          { id: "overview", label: "Overview", icon: Eye },
          { id: "chunks", label: "Evidence", icon: FileStack },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "overview" && (
          <div className="space-y-5">
            {doc.summary && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 p-3 rounded-lg">
                  {doc.summary}
                </p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Metadata</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Period", [doc.period, doc.fiscalYear ? `FY${doc.fiscalYear}` : ""].filter(Boolean).join(" ") || "—"],
                  ["Pages", doc.pageCount ?? "—"],
                  ["Chunks", doc.chunkCount],
                  ["Size", formatKB(doc.sizeBytes)],
                  ["Status", doc.status],
                  ["Uploaded by", (doc.uploadedBy as string)?.split("@")[0] ?? "—"],
                ].map(([label, value]) => (
                  <div key={String(label)} className="bg-card border rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                    <p className="font-medium text-xs capitalize">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {doc.sensitivityTags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sensitivity Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {doc.sensitivityTags.map(t => (
                    <span key={t} className="text-xs bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="h-3 w-3" />{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {doc.tags.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {doc.tags.map(t => (
                    <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "chunks" && <ChunkList docId={doc.id} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("search")
  const [selectedDoc, setSelectedDoc] = useState<RagDocument | null>(null)
  const [typeFilter, setTypeFilter] = useState("all")
  const [browseSearch, setBrowseSearch] = useState("")

  const { data: status } = useApiGet<RagStatus>("/rag/status")
  const { data: docsResp, loading: docsLoading } = useApiGet<{ data: RagDocument[]; total: number; byType: Record<string, number> }>(
    "/rag/documents?limit=100"
  )

  const handleDocClick = (id: string) => {
    const doc = docsResp?.data.find(d => d.id === id)
    if (doc) setSelectedDoc(doc)
  }

  const filteredDocs = (docsResp?.data ?? []).filter(d => {
    if (typeFilter !== "all" && d.type !== typeFilter) return false
    if (browseSearch) {
      const s = browseSearch.toLowerCase()
      return d.title.toLowerCase().includes(s) || d.filename.toLowerCase().includes(s) || d.tags.some(t => t.includes(s))
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Document Intelligence</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Hybrid RAG search across contracts, memos, policy docs, and more.
          </p>
        </div>
        {status && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-green-500/10 text-green-600 border border-green-500/20 px-2.5 py-1.5 rounded-full shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Index operational · {status.indexedDocuments} docs · {status.indexedChunks} chunks
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Documents Indexed" value={status?.indexedDocuments ?? "—"} />
        <StatCard icon={HardDrive} label="Total Chunks" value={status?.indexedChunks ?? "—"} sub={status ? `${status.tableChunks} table chunks` : undefined} />
        <StatCard icon={Table2} label="Table Chunks" value={status?.tableChunks ?? "—"} sub="Financial tables preserved" />
        <StatCard icon={BarChart3} label="Document Types" value={7} sub="All finance categories" />
      </div>

      {/* Provider pills */}
      {status && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(status.providerConfig).map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 rounded-full border border-border/50">
              <span className="text-muted-foreground capitalize">{key}:</span>
              <span className="font-medium">{String(val)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="search" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> RAG Search
          </TabsTrigger>
          <TabsTrigger value="browse" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Browse
          </TabsTrigger>
        </TabsList>

        {/* ── RAG Search tab ─────────────────────────────────────────────── */}
        <TabsContent value="search" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <RagSearchPanel onDocClick={(id) => { handleDocClick(id); }} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Browse tab ────────────────────────────────────────────────── */}
        <TabsContent value="browse" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, filename, tag…"
                  className="pl-9"
                  value={browseSearch}
                  onChange={e => setBrowseSearch(e.target.value)}
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <SelectValue placeholder="Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="policy_doc">Policy</SelectItem>
                  <SelectItem value="close_memo">Close Memo</SelectItem>
                  <SelectItem value="board_deck">Board Deck</SelectItem>
                  <SelectItem value="audit_workpaper">Audit WP</SelectItem>
                  <SelectItem value="sop">SOP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docsLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}><CardContent className="p-5 space-y-3">
                      <Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full mt-4" />
                    </CardContent></Card>
                  ))
                : filteredDocs.length === 0
                ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
                      No documents match your criteria.
                    </div>
                  )
                : filteredDocs.map(doc => (
                    <DocCard key={doc.id} doc={doc} onClick={() => setSelectedDoc(doc)} />
                  ))
              }
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Evidence inspector sheet */}
      <Sheet open={!!selectedDoc} onOpenChange={open => !open && setSelectedDoc(null)}>
        <SheetContent className="sm:max-w-lg p-0 overflow-hidden flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Document Evidence Inspector</SheetTitle>
            <SheetDescription>View document details and evidence chunks</SheetDescription>
          </SheetHeader>
          {selectedDoc && (
            <EvidenceInspector doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
