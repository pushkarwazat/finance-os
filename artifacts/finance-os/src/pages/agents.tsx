import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Bot, Play, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronRight,
  Cpu, FileText, BarChart3, ArrowRight, Loader2, Zap, RefreshCw, ShieldAlert
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface WorkflowRun {
  id: string
  workflowType: string
  agentId: string
  title: string
  status: "queued" | "running" | "awaiting_human" | "awaiting_approval" | "completed" | "failed" | "cancelled"
  currentState: string
  availableTransitions: string[]
  stateHistory: StateTransition[]
  approvalStepIds: string[]
  exceptionIds: string[]
  actionIds: string[]
  toolCallIds: string[]
  auditTrail: AuditEvent[]
  awaitingHuman: boolean
  humanHandoffReason?: string
  fiscalPeriod?: string
  requestedBy: string
  outputSummary?: string
  confidence?: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  explanations?: Explanation[]
}

interface StateTransition {
  fromState: string
  toState: string
  trigger: string
  occurredAt: string
  actor: string
  note?: string
}

interface AuditEvent {
  id: string
  eventType: string
  actor: string
  summary: string
  occurredAt: string
}

interface Explanation {
  conclusion: string
  confidence: number
  confidenceTier: "high" | "medium" | "low" | "abstained"
  confidenceRationale: string
  reasoningChain: { stepIndex: number; title: string; observation: string; pivotal: boolean }[]
  evidence: { id: string; label: string; excerpt: string; sourceTitle: string; relevanceScore: number }[]
  assumptions: string[]
  limitationsAndGaps: string[]
}

interface AgentRegistryEntry {
  agentId: string
  displayName: string
  description: string
  version: string
  workflowType: string
  status: string
  primaryLayer: string
  confidenceThresholds: { minToPublish: number; minToAutoApprove: number; abstainBelow: number }
  requiredTools: string[]
  totalRunsAllTime: number
  averageRunDurationMs?: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  queued:            { label: "Queued",             color: "bg-muted text-muted-foreground border-border",               icon: Clock },
  running:           { label: "Running",            color: "bg-blue-500/15 text-blue-400 border-blue-500/30",           icon: Loader2 },
  awaiting_human:    { label: "Awaiting Human",     color: "bg-amber-500/15 text-amber-400 border-amber-500/30",        icon: Clock },
  awaiting_approval: { label: "Pending Approval",   color: "bg-purple-500/15 text-purple-400 border-purple-500/30",    icon: ShieldAlert },
  completed:         { label: "Completed",          color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  failed:            { label: "Failed",             color: "bg-red-500/15 text-red-400 border-red-500/30",             icon: XCircle },
  cancelled:         { label: "Cancelled",          color: "bg-muted text-muted-foreground border-border",               icon: XCircle },
}

const WORKFLOW_LABELS: Record<string, string> = {
  variance_analysis:   "Variance Analyst",
  reconciliation:      "Reconciliation",
  close_management:    "Close Management",
  ar_collections:      "AR Collections",
  ap_invoice_research: "AP Invoice Research",
  policy_compliance:   "Policy Compliance",
}

const WORKFLOW_ICONS: Record<string, React.ElementType> = {
  variance_analysis:   BarChart3,
  reconciliation:      RefreshCw,
  close_management:    CheckCircle2,
  ar_collections:      FileText,
  ap_invoice_research: FileText,
  policy_compliance:   ShieldAlert,
}

const LAYER_COLORS: Record<string, string> = {
  hybrid:             "bg-blue-500/15 text-blue-400 border-blue-500/30",
  semantic_analytics: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  rag_retrieval:      "bg-teal-500/15 text-teal-400 border-teal-500/30",
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function fmtMs(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// ─── Run status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium", cfg.color)}>
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {cfg.label}
    </span>
  )
}

// ─── Confidence bar ───────────────────────────────────────────────────────────
function ConfidenceBar({ value, tier }: { value: number; tier: string }) {
  const color = tier === "high" ? "bg-emerald-500" : tier === "medium" ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  )
}

// ─── Run detail drawer ────────────────────────────────────────────────────────
function RunDetailDrawer({ runId, open, onClose }: { runId: string; open: boolean; onClose: () => void }) {
  const { data: run, isLoading } = useQuery<WorkflowRun>({
    queryKey: ["workflow-run", runId],
    queryFn: () => apiFetch(`/workflows/runs/${runId}`),
    enabled: open && !!runId,
    refetchInterval: open ? 5000 : false,
  })

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[600px] max-w-full overflow-y-auto bg-background border-border" side="right">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold text-foreground">
            {run?.title ?? "Loading…"}
          </SheetTitle>
          {run && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <StatusBadge status={run.status} />
              {run.fiscalPeriod && (
                <span className="text-xs text-muted-foreground">{run.fiscalPeriod}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {WORKFLOW_LABELS[run.workflowType] ?? run.workflowType}
              </span>
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : run ? (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="bg-muted/50 border border-border w-full">
              <TabsTrigger value="overview" className="flex-1 text-xs">Overview</TabsTrigger>
              <TabsTrigger value="states" className="flex-1 text-xs">State Machine</TabsTrigger>
              <TabsTrigger value="evidence" className="flex-1 text-xs">Evidence</TabsTrigger>
              <TabsTrigger value="audit" className="flex-1 text-xs">Audit Trail</TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {run.awaitingHuman && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-400">Awaiting Human Action</p>
                  <p className="text-xs text-amber-300/80 mt-0.5">{run.humanHandoffReason ?? "Human decision required to proceed."}</p>
                </div>
              )}

              {run.outputSummary && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-foreground mb-1">Conclusion</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{run.outputSummary}</p>
                </div>
              )}

              {run.confidence !== undefined && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-2">Agent Confidence</p>
                  <ConfidenceBar value={run.confidence} tier={run.confidence >= 0.85 ? "high" : run.confidence >= 0.70 ? "medium" : "low"} />
                </div>
              )}

              {run.explanations?.[0] && (
                <>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Reasoning Chain</p>
                    <div className="space-y-2">
                      {run.explanations[0].reasoningChain.map((step) => (
                        <div key={step.stepIndex} className={cn("rounded-lg border p-3", step.pivotal ? "border-blue-500/30 bg-blue-500/5" : "border-border bg-muted/20")}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-foreground">{step.title}</span>
                            {step.pivotal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">key step</span>}
                          </div>
                          <p className="text-xs text-muted-foreground">{step.observation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {run.explanations[0].assumptions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-foreground mb-2">Assumptions</p>
                      <ul className="space-y-1">
                        {run.explanations[0].assumptions.map((a, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex gap-2">
                            <span className="text-blue-400 mt-0.5">·</span>{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{run.toolCallIds.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tool Calls</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{run.approvalStepIds.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Approvals</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-semibold text-foreground">{run.exceptionIds.length}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Exceptions</p>
                </div>
              </div>
            </TabsContent>

            {/* ── State machine ── */}
            <TabsContent value="states" className="mt-4 space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">Current State</p>
                <p className="text-sm font-semibold text-foreground">{run.currentState.replace(/_/g, " ")}</p>
              </div>

              {run.availableTransitions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Available Transitions</p>
                  <div className="flex flex-wrap gap-2">
                    {run.availableTransitions.map((t) => (
                      <span key={t} className="text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">State History</p>
                <div className="relative">
                  {run.stateHistory.map((t, i) => (
                    <div key={i} className="flex gap-3 pb-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-0.5 shrink-0" />
                        {i < run.stateHistory.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{t.toState.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-muted-foreground">via {t.trigger.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{timeSince(t.occurredAt)} · {t.actor}</p>
                        {t.note && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{t.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Evidence ── */}
            <TabsContent value="evidence" className="mt-4 space-y-3">
              {run.explanations?.[0]?.evidence.length ? (
                run.explanations[0].evidence.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-medium text-foreground">{ev.label}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(ev.relevanceScore * 100)}% match</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{ev.excerpt}</p>
                    <p className="text-[10px] text-muted-foreground/60">{ev.sourceTitle}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">No evidence items attached to this run.</p>
              )}
            </TabsContent>

            {/* ── Audit trail ── */}
            <TabsContent value="audit" className="mt-4">
              <div className="space-y-2">
                {run.auditTrail.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-xs py-2 border-b border-border/50 last:border-0">
                    <div className="text-muted-foreground/60 tabular-nums shrink-0 w-14">{timeSince(ev.occurredAt)}</div>
                    <div>
                      <span className="font-medium text-foreground">{ev.eventType.replace(/_/g, " ")}</span>
                      {" · "}
                      <span className="text-muted-foreground">{ev.summary}</span>
                      <span className="ml-1 text-muted-foreground/60">by {ev.actor}</span>
                    </div>
                  </div>
                ))}
                {run.auditTrail.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No audit events yet.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AgentRegistryEntry }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{agent.displayName}</p>
              <p className="text-xs text-muted-foreground">v{agent.version}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", agent.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground")}>
            {agent.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{agent.description}</p>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant="outline" className={cn("text-[10px]", LAYER_COLORS[agent.primaryLayer])}>
            {agent.primaryLayer.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">{agent.requiredTools.length} tools</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">Total Runs</p>
            <p className="text-sm font-semibold text-foreground">{agent.totalRunsAllTime.toLocaleString()}</p>
          </div>
          {agent.averageRunDurationMs && (
            <div>
              <p className="text-xs text-muted-foreground">Avg Duration</p>
              <p className="text-sm font-semibold text-foreground">{fmtMs(agent.averageRunDurationMs)}</p>
            </div>
          )}
        </div>
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1">Min Confidence to Publish</p>
          <ConfidenceBar
            value={agent.confidenceThresholds.minToPublish}
            tier={agent.confidenceThresholds.minToPublish >= 0.85 ? "high" : "medium"}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Run row ──────────────────────────────────────────────────────────────────
function RunRow({ run, onClick }: { run: WorkflowRun; onClick: () => void }) {
  const Icon = WORKFLOW_ICONS[run.workflowType] ?? Bot
  const hasExceptions = run.exceptionIds.length > 0
  const hasPendingApprovals = run.approvalStepIds.length > 0 && run.status === "awaiting_approval"

  return (
    <button
      className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 text-left group"
      onClick={onClick}
    >
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground truncate">{run.title}</p>
          {hasExceptions && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
          {hasPendingApprovals && <ShieldAlert className="h-3.5 w-3.5 text-purple-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{WORKFLOW_LABELS[run.workflowType] ?? run.workflowType}</span>
          {run.fiscalPeriod && <span className="text-xs text-muted-foreground">{run.fiscalPeriod}</span>}
          <span className="text-xs text-muted-foreground">{timeSince(run.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={run.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AgentsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [launchType, setLaunchType] = useState<string | null>(null)
  const [tab, setTab] = useState("runs")
  const queryClient = useQueryClient()

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => apiFetch("/workflows/runs"),
    refetchInterval: 8000,
  })

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["workflow-agents"],
    queryFn: () => apiFetch("/workflows/agents"),
  })

  const launchMutation = useMutation({
    mutationFn: (workflowType: string) =>
      apiFetch("/workflows/runs", {
        method: "POST",
        body: JSON.stringify({ workflowType, payload: { fiscalPeriod: "Q3 FY2025" } }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
      setLaunchType(null)
    },
  })

  const runs: WorkflowRun[] = runsData?.data ?? []
  const agents: AgentRegistryEntry[] = agentsData?.data ?? []

  const runningCount = runs.filter((r) => r.status === "running").length
  const pendingApprovalCount = runs.filter((r) => r.status === "awaiting_approval").length
  const completedCount = runs.filter((r) => r.status === "completed").length
  const exceptionCount = runs.flatMap((r) => r.exceptionIds).length

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workflow Agents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Finance workflow automation — recommend, draft, and route for approval.
          </p>
        </div>
        <div className="relative">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setLaunchType(launchType ? null : "menu")}
          >
            <Play className="h-3.5 w-3.5" />
            Launch Agent
          </Button>
          {launchType === "menu" && (
            <div className="absolute right-0 top-10 z-50 w-56 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
              {(Object.entries(WORKFLOW_LABELS) as [string, string][]).map(([type, label]) => (
                <button
                  key={type}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center justify-between"
                  onClick={() => { setLaunchType(null); launchMutation.mutate(type) }}
                >
                  <span>{label}</span>
                  {launchMutation.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Running", value: runningCount,          icon: Loader2,       color: "text-blue-400",   spin: true  },
          { label: "Pending Approval", value: pendingApprovalCount, icon: ShieldAlert, color: "text-purple-400", spin: false },
          { label: "Completed",value: completedCount,       icon: CheckCircle2,  color: "text-emerald-400",spin: false },
          { label: "Open Exceptions", value: exceptionCount,icon: AlertTriangle, color: "text-amber-400",  spin: false },
        ].map((stat) => (
          <Card key={stat.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={cn("h-5 w-5", stat.color, stat.spin && runningCount > 0 && "animate-spin")} />
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="runs" className="text-xs gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            Workflow Runs
          </TabsTrigger>
          <TabsTrigger value="registry" className="text-xs gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Agent Registry
          </TabsTrigger>
        </TabsList>

        {/* ── Runs list ── */}
        <TabsContent value="runs" className="mt-4">
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="px-4 py-3 border-b border-border">
              <CardTitle className="text-sm font-medium">Recent Workflow Runs</CardTitle>
            </CardHeader>
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Bot className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No workflow runs yet. Launch an agent above.</p>
              </div>
            ) : (
              <div>
                {runs.map((run) => (
                  <RunRow key={run.id} run={run} onClick={() => setSelectedRunId(run.id)} />
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Agent registry ── */}
        <TabsContent value="registry" className="mt-4">
          {agentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard key={agent.agentId} agent={agent} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Run detail drawer ── */}
      <RunDetailDrawer
        runId={selectedRunId ?? ""}
        open={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  )
}
