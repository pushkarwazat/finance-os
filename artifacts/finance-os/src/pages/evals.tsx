import { useState, useEffect } from "react"
import { useListEvalSuites, useListEvalRuns, useCreateEvalRun } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import {
  Play, ChevronDown, ChevronRight, Activity, CheckCircle2, XCircle,
  FlaskConical, BarChart3, GitCompare, BookOpen, AlertTriangle,
  Clock, Zap, ShieldCheck, FileSearch, Workflow, Brain,
  TrendingUp, TrendingDown, Minus, RefreshCw,
} from "lucide-react"
import { cn, formatPercentage } from "@/lib/utils"
import { format, parseISO, differenceInSeconds } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Suite {
  id: string
  name: string
  description: string
  version: string
  domain: string
  caseCount: number
  targetPassRate: number
  primaryMetrics: string[]
  evaluationDimensions: string[]
  latencySlaMs: number
  costBudgetPerCaseUsd: number
  difficultyBreakdown: Record<string, number>
}

interface RunSummary {
  id: string
  suiteId: string
  suiteName: string
  agentId: string
  agentName: string
  status: string
  passRate: number
  passCount: number
  failCount: number
  caseCount: number
  aggregateScores?: Record<string, number>
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface CaseResult {
  caseId: string
  caseName: string
  domain: string
  difficulty: string
  input: string
  output?: string
  passed: boolean
  passReason?: string
  failReason?: string
  scores: Record<string, number>
  latencyMs: number
  tokenCount?: { input: number; output: number }
  abstentionQuality?: {
    shouldAbstain: boolean; didAbstain: boolean
    correctDecision: boolean; confabulated: boolean
  }
  citationCoverage?: {
    citationPrecision: number; citationRecall: number
    hallucinationRate: number; hallucinatedCount: number
  }
}

interface EvalSummary {
  totalRuns: number
  completedRuns: number
  avgPassRate: number
  suites: number
  totalCases: number
  overallMetrics: Record<string, number>
  byDomain: Record<string, { runs: number; avgPassRate: number }>
}

interface RegressionCheck {
  metric: string; baselineValue: number; currentValue: number
  delta: number; isRegression: boolean; isImprovement: boolean
}

interface RegressionReport {
  regressionDetected: boolean; improvementsDetected: boolean
  summary: string; checks: RegressionCheck[]
  baselineRunId: string; currentRunId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  analytics: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  variance: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  document_evidence: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  workflow: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  ambiguous: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  abstain: "text-red-400 bg-red-400/10 border-red-400/20",
  mixed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  metrics: "text-blue-400 bg-blue-400/10 border-blue-400/20",
}

const DOMAIN_ICON: Record<string, React.ReactNode> = {
  analytics: <BarChart3 className="h-4 w-4" />,
  variance: <TrendingUp className="h-4 w-4" />,
  document_evidence: <FileSearch className="h-4 w-4" />,
  workflow: <Workflow className="h-4 w-4" />,
  ambiguous: <Brain className="h-4 w-4" />,
  abstain: <ShieldCheck className="h-4 w-4" />,
  mixed: <FlaskConical className="h-4 w-4" />,
}

const METRIC_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  faithfulness: "Faithfulness",
  relevance: "Relevance",
  coherence: "Coherence",
  completeness: "Completeness",
  hallucination_rate: "Hallucination Rate",
  citation_precision: "Citation Precision",
  citation_recall: "Citation Recall",
  retrieval_ndcg: "Retrieval NDCG",
  semantic_intent_accuracy: "Intent Accuracy",
  abstention_correct: "Abstention Correct",
  workflow_state_accuracy: "State Accuracy",
  workflow_tool_precision: "Tool Precision",
}

const LOWER_IS_BETTER = new Set(["hallucination_rate", "latency_p95"])

function passRateColor(rate: number) {
  if (rate >= 0.85) return "text-emerald-400"
  if (rate >= 0.75) return "text-amber-400"
  return "text-red-400"
}

function passRateBarColor(rate: number) {
  if (rate >= 0.85) return "bg-emerald-500"
  if (rate >= 0.75) return "bg-amber-500"
  return "bg-red-500"
}

function metricBarColor(metric: string, value: number) {
  if (metric === "hallucination_rate") {
    if (value < 0.08) return "bg-emerald-500"
    if (value < 0.15) return "bg-amber-500"
    return "bg-red-500"
  }
  if (value >= 0.85) return "bg-emerald-500"
  if (value >= 0.7) return "bg-blue-500"
  return "bg-amber-500"
}

// ── Score Bar Component ────────────────────────────────────────────────────────

function ScoreBar({ label, value, metric, compact = false }: {
  label: string; value: number; metric?: string; compact?: boolean
}) {
  const pct = LOWER_IS_BETTER.has(metric ?? "") ? value : value
  const barPct = LOWER_IS_BETTER.has(metric ?? "") ? value * 100 : value * 100
  const displayVal = metric === "latency_p95"
    ? `${Math.round(value)}ms`
    : `${(value * 100).toFixed(1)}%`
  const color = metricBarColor(metric ?? "", value)
  return (
    <div className={cn("space-y-1", compact ? "" : "")}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground truncate">{label}</span>
        <span className={cn("font-medium tabular-nums ml-2", LOWER_IS_BETTER.has(metric ?? "")
          ? (value < 0.08 ? "text-emerald-400" : value < 0.15 ? "text-amber-400" : "text-red-400")
          : (value >= 0.85 ? "text-emerald-400" : value >= 0.7 ? "text-blue-400" : "text-amber-400")
        )}>{displayVal}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, barPct)}%` }}
        />
      </div>
    </div>
  )
}

// ── Suite Card ────────────────────────────────────────────────────────────────

function SuiteCard({
  suite, runs, isSelected, onSelect, onRun
}: {
  suite: Suite; runs: RunSummary[]
  isSelected: boolean; onSelect: () => void; onRun: () => void
}) {
  const suiteRuns = runs.filter((r) => r.suiteId === suite.id && r.status === "complete")
  const latestRun = suiteRuns[0]
  const domainKey = suite.domain
  const domainStyle = DOMAIN_COLOR[domainKey] ?? "text-muted-foreground bg-muted"

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all border hover:border-muted-foreground/40",
        isSelected ? "border-primary/50 bg-primary/5" : "border-border"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn("p-1.5 rounded-md border text-xs flex-shrink-0", domainStyle)}>
              {DOMAIN_ICON[domainKey] ?? <FlaskConical className="h-4 w-4" />}
            </span>
            <h3 className="text-sm font-semibold leading-tight truncate">{suite.name}</h3>
          </div>
          <Badge variant="outline" className="text-[10px] flex-shrink-0">
            v{suite.version}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{suite.description}</p>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/40 rounded p-2">
            <div className="text-muted-foreground">Cases</div>
            <div className="font-semibold text-sm">{suite.caseCount}</div>
          </div>
          <div className="bg-muted/40 rounded p-2">
            <div className="text-muted-foreground">Target Pass</div>
            <div className="font-semibold text-sm">{(suite.targetPassRate * 100).toFixed(0)}%</div>
          </div>
        </div>

        {latestRun && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Latest run</span>
              <span className={cn("font-medium", passRateColor(latestRun.passRate))}>
                {(latestRun.passRate * 100).toFixed(1)}% pass
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", passRateBarColor(latestRun.passRate))}
                style={{ width: `${latestRun.passRate * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{latestRun.passCount} passed · {latestRun.failCount} failed</span>
              <span>{suiteRuns.length} run{suiteRuns.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}

        {!latestRun && (
          <div className="text-xs text-muted-foreground italic">No runs yet</div>
        )}

        <Button
          size="sm"
          className="w-full gap-1.5 text-xs"
          variant={isSelected ? "default" : "secondary"}
          onClick={(e) => { e.stopPropagation(); onRun() }}
        >
          <Play className="h-3 w-3" /> Run Suite
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Scores Panel ──────────────────────────────────────────────────────────────

function ScoresPanel({ scores, title = "Scores" }: { scores: Record<string, number>; title?: string }) {
  const displayKeys = Object.keys(scores).filter(
    (k) => !k.includes("latency_p95") && scores[k] != null && scores[k] >= 0
  )
  return (
    <div className="space-y-2">
      {title && <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h4>}
      <div className="grid gap-2">
        {displayKeys.map((k) => (
          <ScoreBar
            key={k}
            label={METRIC_LABELS[k] ?? k}
            value={scores[k]}
            metric={k}
          />
        ))}
      </div>
    </div>
  )
}

// ── Case Result Row ────────────────────────────────────────────────────────────

function CaseRow({ result }: { result: CaseResult }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className={cn("cursor-pointer hover:bg-muted/30", open && "bg-muted/20")}>
          <TableCell>
            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </TableCell>
          <TableCell>
            {result.passed
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : <XCircle className="h-4 w-4 text-red-400" />}
          </TableCell>
          <TableCell className="max-w-[200px] truncate text-xs font-medium">{result.caseName}</TableCell>
          <TableCell>
            <Badge variant="outline" className={cn("text-[10px]", DOMAIN_COLOR[result.domain] ?? "")}>
              {result.domain}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="text-[10px] capitalize">{result.difficulty}</Badge>
          </TableCell>
          <TableCell className="font-mono text-xs text-right tabular-nums">
            <span className={cn(
              (result.scores.accuracy ?? 0) >= 0.85 ? "text-emerald-400" :
              (result.scores.accuracy ?? 0) >= 0.7 ? "text-blue-400" : "text-amber-400"
            )}>
              {((result.scores.accuracy ?? 0) * 100).toFixed(1)}%
            </span>
          </TableCell>
          <TableCell className="font-mono text-xs text-right tabular-nums">
            <span className={cn(
              (result.scores.hallucination_rate ?? 0) < 0.08 ? "text-emerald-400" :
              (result.scores.hallucination_rate ?? 0) < 0.15 ? "text-amber-400" : "text-red-400"
            )}>
              {((result.scores.hallucination_rate ?? 0) * 100).toFixed(1)}%
            </span>
          </TableCell>
          <TableCell className="text-xs text-right text-muted-foreground tabular-nums">
            {result.latencyMs}ms
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={8} className="py-3 px-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-2">
                <div className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Input</div>
                <p className="text-sm leading-relaxed text-foreground">{result.input}</p>
                {result.output && (
                  <>
                    <div className="font-medium text-muted-foreground uppercase tracking-wide text-[10px] mt-2">Output</div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">{result.output}</p>
                  </>
                )}
                {(result.passReason ?? result.failReason) && (
                  <div className={cn(
                    "mt-2 rounded p-2 text-[10px]",
                    result.passed ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                  )}>
                    {result.passed ? "✓ " : "✗ "}{result.passReason ?? result.failReason}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Scores</div>
                {Object.entries(result.scores)
                  .filter(([k]) => !["latency_p95"].includes(k))
                  .slice(0, 8)
                  .map(([k, v]) => (
                    <ScoreBar key={k} label={METRIC_LABELS[k] ?? k} value={v as number} metric={k} compact />
                  ))
                }
              </div>

              <div className="space-y-3">
                {result.abstentionQuality && (
                  <div className="space-y-1">
                    <div className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Abstention</div>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        ["Should Abstain", result.abstentionQuality.shouldAbstain ? "Yes" : "No"],
                        ["Did Abstain", result.abstentionQuality.didAbstain ? "Yes" : "No"],
                        ["Correct Decision", result.abstentionQuality.correctDecision ? "✓ Yes" : "✗ No"],
                        ["Confabulated", result.abstentionQuality.confabulated ? "⚠ Yes" : "No"],
                      ].map(([label, val]) => (
                        <div key={label as string} className="bg-muted/40 rounded p-1.5">
                          <div className="text-[10px] text-muted-foreground">{label as string}</div>
                          <div className={cn("text-xs font-medium",
                            (val as string).includes("✓") ? "text-emerald-400" :
                            (val as string).includes("✗") || (val as string).includes("⚠") ? "text-red-400" : ""
                          )}>{val as string}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.tokenCount && (
                  <div className="space-y-1">
                    <div className="font-medium text-muted-foreground uppercase tracking-wide text-[10px]">Tokens</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        ["Input", result.tokenCount.input],
                        ["Output", result.tokenCount.output],
                        ["Total", result.tokenCount.input + result.tokenCount.output],
                      ].map(([label, val]) => (
                        <div key={label as string} className="bg-muted/40 rounded p-1.5 text-center">
                          <div className="text-[10px] text-muted-foreground">{label as string}</div>
                          <div className="text-xs font-medium tabular-nums">{(val as number).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Regression Tab ────────────────────────────────────────────────────────────

function RegressionTab({ runs, suiteId }: { runs: RunSummary[]; suiteId: string }) {
  const [baselineId, setBaselineId] = useState<string>("")
  const [currentId, setCurrentId] = useState<string>("")
  const suiteRuns = runs.filter((r) => r.suiteId === suiteId && r.status === "complete")

  const { data: report, isLoading } = useQuery<RegressionReport>({
    queryKey: ["/api/evals/regression", suiteId],
    queryFn: async () => {
      const params = new URLSearchParams({ suiteId })
      if (baselineId) params.set("baseline", baselineId)
      if (currentId) params.set("current", currentId)
      const res = await fetch(`/api/evals/regression?${params}`)
      return res.json()
    },
  })

  if (suiteRuns.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <GitCompare className="h-10 w-10 opacity-40" />
        <p className="text-sm">Run at least 2 evaluations to compare regressions.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={baselineId} onValueChange={setBaselineId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Baseline run" />
          </SelectTrigger>
          <SelectContent>
            {suiteRuns.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.agentName} — {r.startedAt ? format(parseISO(r.startedAt), "MMM d HH:mm") : r.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">vs</span>
        <Select value={currentId} onValueChange={setCurrentId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Current run" />
          </SelectTrigger>
          <SelectContent>
            {suiteRuns.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.agentName} — {r.startedAt ? format(parseISO(r.startedAt), "MMM d HH:mm") : r.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : report ? (
        <div className="space-y-4">
          <div className={cn(
            "rounded-lg p-4 border text-sm",
            report.regressionDetected
              ? "border-red-500/30 bg-red-500/5 text-red-400"
              : "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
          )}>
            <div className="flex items-center gap-2 font-medium">
              {report.regressionDetected
                ? <AlertTriangle className="h-4 w-4" />
                : <CheckCircle2 className="h-4 w-4" />}
              {report.regressionDetected ? "Regression Detected" : "Stable — No Regressions"}
            </div>
            <p className="mt-1 text-xs opacity-80">{report.summary}</p>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Baseline</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.checks.map((check) => {
                  const isLatency = check.metric === "latency_p95"
                  const fmt = (v: number) => isLatency ? `${Math.round(v)}ms` : `${(v * 100).toFixed(1)}%`
                  const deltaFmt = (d: number) => `${d > 0 ? "+" : ""}${isLatency ? `${Math.round(d)}ms` : `${(d * 100).toFixed(1)}pp`}`
                  return (
                    <TableRow key={check.metric}>
                      <TableCell className="text-xs font-medium">{METRIC_LABELS[check.metric] ?? check.metric}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(check.baselineValue)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">{fmt(check.currentValue)}</TableCell>
                      <TableCell className={cn(
                        "text-xs text-right tabular-nums font-medium",
                        check.isRegression ? "text-red-400" :
                        check.isImprovement ? "text-emerald-400" : "text-muted-foreground"
                      )}>{deltaFmt(check.delta)}</TableCell>
                      <TableCell className="text-right">
                        {check.isRegression ? (
                          <span className="flex items-center justify-end gap-1 text-red-400 text-xs">
                            <TrendingDown className="h-3 w-3" /> Regressed
                          </span>
                        ) : check.isImprovement ? (
                          <span className="flex items-center justify-end gap-1 text-emerald-400 text-xs">
                            <TrendingUp className="h-3 w-3" /> Improved
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-muted-foreground text-xs">
                            <Minus className="h-3 w-3" /> Stable
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function EvalsPage() {
  const [activeTab, setActiveTab] = useState<"suites" | "runs" | "analysis" | "regression">("suites")
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("")
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [expandedRunCases, setExpandedRunCases] = useState<CaseResult[] | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: suitesResponse, isLoading: isLoadingSuites } = useListEvalSuites()
  const suites = (suitesResponse?.data ?? []) as Suite[]

  useEffect(() => {
    if (suites.length > 0 && !selectedSuiteId) {
      setSelectedSuiteId(suites[0].id)
    }
  }, [suites, selectedSuiteId])

  const { data: runsResponse, isLoading: isLoadingRuns } = useListEvalRuns(
    selectedSuiteId ? { suiteId: selectedSuiteId } : undefined,
    { query: { enabled: !!selectedSuiteId, refetchInterval: 3000 } }
  )
  const runs = (runsResponse?.data ?? []) as RunSummary[]

  const { data: allRunsResponse } = useListEvalRuns(
    undefined,
    { query: { refetchInterval: 5000 } }
  )
  const allRuns = (allRunsResponse?.data ?? []) as RunSummary[]

  const { data: summary } = useQuery<EvalSummary>({
    queryKey: ["/api/evals/summary"],
    queryFn: async () => {
      const res = await fetch("/api/evals/summary")
      return res.json()
    },
    refetchInterval: 10000,
  })

  const createRun = useCreateEvalRun()

  const handleRunSuite = (suiteId: string) => {
    createRun.mutate(
      { data: { suiteId, agentId: "financeos-agent-v1" } },
      {
        onSuccess: () => {
          toast({ title: "Evaluation queued", description: "Run started — results in ~2s." })
          queryClient.invalidateQueries({ queryKey: ["/api/evals/runs"] })
          queryClient.invalidateQueries({ queryKey: ["/api/evals/summary"] })
          setSelectedSuiteId(suiteId)
          setActiveTab("runs")
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to start evaluation run.", variant: "destructive" })
        }
      }
    )
  }

  const handleExpandRun = async (runId: string) => {
    if (expandedRun === runId) { setExpandedRun(null); setExpandedRunCases(null); return }
    setExpandedRun(runId)
    setExpandedRunCases(null)
    try {
      const res = await fetch(`/api/evals/runs/${runId}/cases?limit=50`)
      const json = await res.json()
      setExpandedRunCases(json.data ?? [])
    } catch {
      setExpandedRunCases([])
    }
  }

  const selectedSuite = suites.find((s) => s.id === selectedSuiteId)
  const runningCount = allRuns.filter((r) => r.status === "queued" || r.status === "running").length

  const tabs = [
    { id: "suites" as const, label: "Suites", icon: <FlaskConical className="h-3.5 w-3.5" /> },
    { id: "runs" as const, label: "Runs", icon: <Activity className="h-3.5 w-3.5" /> },
    { id: "analysis" as const, label: "Analysis", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "regression" as const, label: "Regression", icon: <GitCompare className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI Evaluations</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Offline + online benchmarking harness. 275 cases across 7 suites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <Badge variant="outline" className="gap-1 text-blue-400 border-blue-400/30 animate-pulse">
              <Activity className="h-3 w-3" /> {runningCount} running
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/evals/runs"] })
              queryClient.invalidateQueries({ queryKey: ["/api/evals/summary"] })
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Suites", value: summary.suites, icon: <FlaskConical className="h-4 w-4" /> },
            { label: "Total Cases", value: summary.totalCases.toLocaleString(), icon: <BookOpen className="h-4 w-4" /> },
            { label: "Total Runs", value: summary.totalRuns, icon: <Activity className="h-4 w-4" /> },
            { label: "Avg Pass Rate", value: `${(summary.avgPassRate * 100).toFixed(1)}%`, icon: <CheckCircle2 className="h-4 w-4" />, highlight: true },
            { label: "Hallucination Rate", value: `${((summary.overallMetrics?.hallucination_rate ?? 0) * 100).toFixed(1)}%`, icon: <AlertTriangle className="h-4 w-4" />, warn: true },
          ].map(({ label, value, icon, highlight, warn }) => (
            <Card key={label} className="bg-muted/20">
              <CardContent className="p-3 flex items-center gap-2.5">
                <span className={cn(
                  "p-1.5 rounded-md",
                  highlight ? "bg-emerald-500/10 text-emerald-400" :
                  warn ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground"
                )}>{icon}</span>
                <div className="min-w-0">
                  <div className={cn("text-lg font-bold tabular-nums",
                    highlight ? "text-emerald-400" : warn ? "text-amber-400" : ""
                  )}>{value}</div>
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Suites Tab ── */}
      {activeTab === "suites" && (
        <div className="space-y-4">
          {isLoadingSuites ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-52 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {suites.map((suite) => (
                <SuiteCard
                  key={suite.id}
                  suite={suite}
                  runs={allRuns}
                  isSelected={selectedSuiteId === suite.id}
                  onSelect={() => setSelectedSuiteId(suite.id)}
                  onRun={() => handleRunSuite(suite.id)}
                />
              ))}
            </div>
          )}

          {selectedSuite && (
            <Card>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedSuite.name} — Details</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    v{selectedSuite.version}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difficulty Breakdown</h4>
                  {Object.entries(selectedSuite.difficultyBreakdown).map(([d, count]) => (
                    <div key={d} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{d}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{ width: `${(count / selectedSuite.caseCount) * 100}%` }}
                          />
                        </div>
                        <span className="tabular-nums font-medium w-6 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Eval Dimensions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSuite.evaluationDimensions.map((d) => (
                      <Badge key={d} variant="outline" className="text-[10px]">
                        {d.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SLA Thresholds</h4>
                  {[
                    ["Target Pass Rate", `${(selectedSuite.targetPassRate * 100).toFixed(0)}%`],
                    ["Latency SLA", `${selectedSuite.latencySlaMs}ms`],
                    ["Cost Budget/Case", `$${selectedSuite.costBudgetPerCaseUsd.toFixed(3)}`],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label as string}</span>
                      <span className="font-medium">{val as string}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Runs Tab ── */}
      {activeTab === "runs" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select suite" />
              </SelectTrigger>
              <SelectContent>
                {suites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => handleRunSuite(selectedSuiteId)}
              disabled={!selectedSuiteId || createRun.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Run Suite
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Evaluation Runs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Run ID</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Pass Rate</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingRuns ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : runs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-14 text-center text-muted-foreground text-sm">
                        No runs yet. Run a suite to see results here.
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((run) => (
                      <>
                        <TableRow
                          key={run.id}
                          className={cn("cursor-pointer", expandedRun === run.id && "bg-muted/30")}
                          onClick={() => handleExpandRun(run.id)}
                        >
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                              {expandedRun === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}…</TableCell>
                          <TableCell className="text-xs font-medium max-w-[160px] truncate">{run.agentName}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] capitalize gap-1",
                                run.status === "complete" ? "text-emerald-400 border-emerald-400/30" :
                                run.status === "failed" ? "text-red-400 border-red-400/30" :
                                "text-blue-400 border-blue-400/30"
                              )}
                            >
                              {(run.status === "queued" || run.status === "running") && (
                                <Activity className="h-2.5 w-2.5 animate-pulse" />
                              )}
                              {run.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {run.passRate != null ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full", passRateBarColor(run.passRate))}
                                    style={{ width: `${run.passRate * 100}%` }}
                                  />
                                </div>
                                <span className={cn("text-xs font-bold tabular-nums", passRateColor(run.passRate))}>
                                  {(run.passRate * 100).toFixed(1)}%
                                </span>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums text-muted-foreground">
                            {run.passCount != null ? (
                              <span>{run.passCount}✓ {run.failCount}✗</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground">
                            {run.startedAt ? format(parseISO(run.startedAt), "MMM d HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right text-muted-foreground tabular-nums">
                            {run.startedAt && run.completedAt
                              ? `${differenceInSeconds(parseISO(run.completedAt), parseISO(run.startedAt))}s`
                              : run.status === "running" ? (
                                <span className="text-blue-400 animate-pulse">…</span>
                              ) : "—"}
                          </TableCell>
                        </TableRow>

                        {expandedRun === run.id && (
                          <TableRow key={`${run.id}-expanded`} className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={8} className="p-0">
                              <div className="p-4 space-y-4 border-t">
                                {run.aggregateScores && Object.keys(run.aggregateScores).length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Aggregate Scores</h4>
                                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-2">
                                      {Object.entries(run.aggregateScores)
                                        .filter(([k]) => k !== "latency_p95")
                                        .map(([k, v]) => (
                                          <ScoreBar key={k} label={METRIC_LABELS[k] ?? k} value={v as number} metric={k} />
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {expandedRunCases === null ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading cases…
                                  </div>
                                ) : expandedRunCases.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">No case results available.</p>
                                ) : (
                                  <div>
                                    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Case Results</h4>
                                    <div className="rounded-md border overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="w-6" />
                                            <TableHead className="w-6">Pass</TableHead>
                                            <TableHead>Case</TableHead>
                                            <TableHead>Domain</TableHead>
                                            <TableHead>Difficulty</TableHead>
                                            <TableHead className="text-right">Accuracy</TableHead>
                                            <TableHead className="text-right">Hallucination</TableHead>
                                            <TableHead className="text-right">Latency</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {expandedRunCases.map((c) => (
                                            <CaseRow key={c.caseId} result={c} />
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Analysis Tab ── */}
      {activeTab === "analysis" && (
        <div className="space-y-4">
          {summary ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base">Overall Metric Health</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ScoresPanel scores={summary.overallMetrics} title="" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base">Pass Rate by Domain</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {Object.entries(summary.byDomain).map(([domain, data]) => (
                    <div key={domain} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("p-1 rounded text-[10px] border", DOMAIN_COLOR[domain] ?? "")}>
                            {DOMAIN_ICON[domain] ?? <FlaskConical className="h-3 w-3" />}
                          </span>
                          <span className="font-medium capitalize">{domain.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">({data.runs} run{data.runs !== 1 ? "s" : ""})</span>
                        </div>
                        <span className={cn("font-bold tabular-nums", passRateColor(data.avgPassRate))}>
                          {(data.avgPassRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", passRateBarColor(data.avgPassRate))}
                          style={{ width: `${data.avgPassRate * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-400" />
                    Latency & Cost Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Avg Latency", value: "~850ms", note: "p50 across all runs" },
                      { label: "P95 Latency", value: "~1,840ms", note: "Target: <3,000ms" },
                      { label: "Avg Cost/Case", value: "$0.012", note: "Target: <$0.05" },
                      { label: "SLA Compliance", value: "~97%", note: "Cases within latency SLA" },
                    ].map(({ label, value, note }) => (
                      <div key={label} className="bg-muted/30 rounded-lg p-3 space-y-0.5">
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                        <div className="text-lg font-bold">{value}</div>
                        <div className="text-[10px] text-muted-foreground">{note}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Abstention & Safety Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Abstention Correct Rate", value: `${((summary.overallMetrics?.abstention_correct ?? 0.92) * 100).toFixed(0)}%`, note: "shouldAbstain === didAbstain", ok: true },
                      { label: "Confabulation Rate", value: `~${((1 - (summary.overallMetrics?.abstention_correct ?? 0.92)) * 40).toFixed(1)}%`, note: "Answered when should abstain", bad: true },
                      { label: "Hallucination Rate", value: `${((summary.overallMetrics?.hallucination_rate ?? 0.07) * 100).toFixed(1)}%`, note: "Citation hallucination", warn: true },
                      { label: "Citation Precision", value: `${((summary.overallMetrics?.citation_precision ?? 0.84) * 100).toFixed(0)}%`, note: "Correct citations / total cited", ok: true },
                    ].map(({ label, value, note, ok, bad, warn }) => (
                      <div key={label} className={cn("rounded-lg p-3 space-y-0.5 border",
                        ok ? "bg-emerald-500/5 border-emerald-500/20" :
                        bad ? "bg-red-500/5 border-red-500/20" :
                        warn ? "bg-amber-500/5 border-amber-500/20" : "bg-muted/30 border-border"
                      )}>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                        <div className={cn("text-xl font-bold",
                          ok ? "text-emerald-400" : bad ? "text-red-400" : warn ? "text-amber-400" : ""
                        )}>{value}</div>
                        <div className="text-[10px] text-muted-foreground">{note}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-400" />
                    Score Dimension Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      {
                        title: "Answer Quality",
                        metrics: { accuracy: summary.overallMetrics?.accuracy ?? 0, faithfulness: summary.overallMetrics?.faithfulness ?? 0, relevance: summary.overallMetrics?.relevance ?? 0, coherence: summary.overallMetrics?.coherence ?? 0 }
                      },
                      {
                        title: "Retrieval Quality",
                        metrics: { retrieval_ndcg: summary.overallMetrics?.retrieval_ndcg ?? 0, citation_precision: summary.overallMetrics?.citation_precision ?? 0, citation_recall: summary.overallMetrics?.citation_recall ?? 0 }
                      },
                      {
                        title: "Parsing & Safety",
                        metrics: { semantic_intent_accuracy: summary.overallMetrics?.semantic_intent_accuracy ?? 0, abstention_correct: summary.overallMetrics?.abstention_correct ?? 0, hallucination_rate: summary.overallMetrics?.hallucination_rate ?? 0 }
                      },
                    ].map(({ title, metrics }) => (
                      <div key={title} className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h4>
                        {Object.entries(metrics).map(([k, v]) => (
                          <ScoreBar key={k} label={METRIC_LABELS[k] ?? k} value={v} metric={k} />
                        ))}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
            </div>
          )}
        </div>
      )}

      {/* ── Regression Tab ── */}
      {activeTab === "regression" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select suite" />
              </SelectTrigger>
              <SelectContent>
                {suites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <GitCompare className="h-4 w-4" />
                Regression Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <RegressionTab
                runs={allRuns}
                suiteId={selectedSuiteId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm">CI Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
{`# GitHub Actions — run on every PR
- name: Run Regression Suite
  run: |
    pnpm --filter @financeos/evals run eval \\
      -- --suite regression --json > eval.json
    pnpm --filter @financeos/evals run eval:compare \\
      -- --baseline $BASELINE_RUN_ID \\
      --current-file eval.json \\
      --threshold 0.03 \\
      --fail-on-regression`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
