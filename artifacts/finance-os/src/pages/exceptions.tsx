import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle, AlertOctagon, CheckCircle2, XCircle,
  ChevronRight, Loader2, ShieldOff, DollarSign, Clock, BookOpen
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface WorkflowException {
  id: string
  workflowRunId: string
  agentId: string
  severity: "critical" | "high" | "medium" | "low" | "info"
  category: string
  status: "open" | "acknowledged" | "in_review" | "resolved" | "waived" | "escalated"
  title: string
  description: string
  technicalDetail?: string
  evidenceIds: string[]
  amountUsd?: number
  accounts: string[]
  notifiedRoles: string[]
  resolvedBy: string | null
  resolutionNote?: string
  waivedBy: string | null
  waiverRationale?: string
  raisedAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: "Critical", color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30",       icon: AlertOctagon   },
  high:     { label: "High",     color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30", icon: AlertTriangle   },
  medium:   { label: "Medium",   color: "text-amber-400",  bg: "bg-amber-500/15 border-amber-500/30",   icon: AlertTriangle   },
  low:      { label: "Low",      color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle   },
  info:     { label: "Info",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",     icon: BookOpen        },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:         { label: "Open",         color: "bg-red-500/15 text-red-400 border-red-500/30"              },
  acknowledged: { label: "Acknowledged", color: "bg-amber-500/15 text-amber-400 border-amber-500/30"        },
  in_review:    { label: "In Review",    color: "bg-blue-500/15 text-blue-400 border-blue-500/30"           },
  resolved:     { label: "Resolved",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"  },
  waived:       { label: "Waived",       color: "bg-muted text-muted-foreground border-border"               },
  escalated:    { label: "Escalated",    color: "bg-orange-500/15 text-orange-400 border-orange-500/30"     },
}

const CATEGORY_LABELS: Record<string, string> = {
  data_quality:         "Data Quality",
  threshold_breach:     "Threshold Breach",
  policy_violation:     "Policy Violation",
  reconciliation_break: "Reconciliation Break",
  approval_timeout:     "Approval Timeout",
  confidence_low:       "Low Confidence",
  tool_failure:         "Tool Failure",
  escalation:           "Escalation",
  access_control:       "Access Control",
}

function timeSince(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

// ─── Exception detail sheet ───────────────────────────────────────────────────
function ExceptionDetailSheet({
  exception: ex,
  open,
  onClose,
}: {
  exception: WorkflowException | null
  open: boolean
  onClose: () => void
}) {
  const [note, setNote] = useState("")
  const [mode, setMode] = useState<"idle" | "resolve" | "waive">("idle")
  const queryClient = useQueryClient()

  const resolveMutation = useMutation({
    mutationFn: (waive: boolean) =>
      apiFetch(`/workflows/exceptions/${ex!.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolvedBy: "J. Davies (Controller)", note, waive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-exceptions"] })
      setNote("")
      setMode("idle")
      onClose()
    },
  })

  if (!ex) return null
  const severityCfg = SEVERITY_CONFIG[ex.severity] ?? SEVERITY_CONFIG.medium
  const statusCfg = STATUS_CONFIG[ex.status] ?? STATUS_CONFIG.open
  const SeverityIcon = severityCfg.icon
  const isOpen = ["open", "acknowledged", "in_review", "escalated"].includes(ex.status)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] max-w-full overflow-y-auto bg-background border-border" side="right">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <SeverityIcon className={cn("h-4 w-4", severityCfg.color)} />
            {ex.title}
          </SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <span className={cn("text-xs px-2 py-0.5 rounded-md border font-medium", severityCfg.bg, severityCfg.color)}>
              {severityCfg.label}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-md border font-medium", statusCfg.color)}>
              {statusCfg.label}
            </span>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{ex.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <p className="text-sm font-medium text-foreground">{CATEGORY_LABELS[ex.category] ?? ex.category}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Raised</p>
              <p className="text-sm font-medium text-foreground">{timeSince(ex.raisedAt)}</p>
            </div>
            {ex.amountUsd && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />Amount
                </p>
                <p className="text-sm font-medium text-foreground">{fmtUsd(ex.amountUsd)}</p>
              </div>
            )}
            {ex.accounts.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground mb-1">Accounts</p>
                <p className="text-sm font-medium text-foreground">{ex.accounts.join(", ")}</p>
              </div>
            )}
          </div>

          {ex.notifiedRoles.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1.5">Notified Roles</p>
              <div className="flex flex-wrap gap-1.5">
                {ex.notifiedRoles.map((r) => (
                  <span key={r} className="text-xs px-2 py-0.5 rounded-md bg-muted border border-border text-muted-foreground">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ex.technicalDetail && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Technical Detail</p>
              <p className="text-xs text-muted-foreground/80 font-mono leading-relaxed">{ex.technicalDetail}</p>
            </div>
          )}

          {/* Resolution / waiver */}
          {isOpen && mode === "idle" && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" onClick={() => setMode("resolve")}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Resolve
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => setMode("waive")}>
                <ShieldOff className="h-3.5 w-3.5" />
                Waive
              </Button>
            </div>
          )}

          {(mode === "resolve" || mode === "waive") && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-medium text-foreground">
                {mode === "resolve" ? "Resolution Note" : "Waiver Rationale"}
              </p>
              <Textarea
                placeholder={mode === "resolve" ? "Describe how this exception was resolved…" : "Provide documented rationale for waiving this exception…"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="text-sm bg-background border-border resize-none"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className={cn("flex-1", mode === "resolve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-muted hover:bg-muted/80")}
                  disabled={resolveMutation.isPending || !note.trim()}
                  onClick={() => resolveMutation.mutate(mode === "waive")}
                >
                  {resolveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === "resolve" ? "Mark Resolved" : "Waive Exception"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setMode("idle"); setNote("") }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {(ex.resolutionNote || ex.waiverRationale) && (
            <div className={cn("rounded-lg border p-3", ex.status === "waived" ? "border-muted bg-muted/20" : "border-emerald-500/30 bg-emerald-500/10")}>
              <p className={cn("text-xs font-medium", ex.status === "waived" ? "text-muted-foreground" : "text-emerald-400")}>
                {ex.status === "waived" ? `Waived by ${ex.waivedBy}` : `Resolved by ${ex.resolvedBy}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{ex.resolutionNote ?? ex.waiverRationale}</p>
              {ex.resolvedAt && <p className="text-xs text-muted-foreground/60 mt-1">{timeSince(ex.resolvedAt)}</p>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ExceptionsPage() {
  const [selected, setSelected] = useState<WorkflowException | null>(null)
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "waived">("open")
  const [severityFilter, setSeverityFilter] = useState<string>("all")

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-exceptions", filter],
    queryFn: () => apiFetch(`/workflows/exceptions${filter !== "all" ? `?status=${filter}` : ""}`),
    refetchInterval: 10000,
  })

  const exceptions: WorkflowException[] = data?.data ?? []
  const filtered = severityFilter === "all" ? exceptions : exceptions.filter((e) => e.severity === severityFilter)

  const openCount = exceptions.filter((e) => ["open", "acknowledged", "in_review", "escalated"].includes(e.status)).length
  const criticalCount = exceptions.filter((e) => e.severity === "critical" || e.severity === "high").length
  const resolvedCount = exceptions.filter((e) => e.status === "resolved" || e.status === "waived").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Exceptions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Threshold breaches, policy violations, and escalation signals from workflow agents.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open",              value: openCount,     icon: AlertTriangle, color: "text-amber-400"  },
          { label: "Critical / High",   value: criticalCount, icon: AlertOctagon,  color: "text-red-400"    },
          { label: "Resolved / Waived", value: resolvedCount, icon: CheckCircle2,  color: "text-emerald-400"},
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("h-5 w-5", s.color)} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {(["open", "all", "resolved", "waived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {(["all", "critical", "high", "medium", "low"] as const).map((s) => {
            const cfg = s === "all" ? null : SEVERITY_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors border",
                  severityFilter === s
                    ? cfg ? cn(cfg.bg, cfg.color) : "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
                )}
              >
                {s === "all" ? "All Severities" : SEVERITY_CONFIG[s].label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Exceptions list ── */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-sm font-medium">
            Exceptions ({filtered.length})
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-400/40" />
            <p className="text-sm text-muted-foreground">No exceptions found.</p>
          </div>
        ) : (
          <div>
            {filtered.map((ex) => {
              const sevCfg = SEVERITY_CONFIG[ex.severity] ?? SEVERITY_CONFIG.medium
              const staCfg = STATUS_CONFIG[ex.status] ?? STATUS_CONFIG.open
              const SevIcon = sevCfg.icon
              return (
                <button
                  key={ex.id}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 text-left group"
                  onClick={() => setSelected(ex)}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border", sevCfg.bg)}>
                    <SevIcon className={cn("h-4 w-4", sevCfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ex.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[ex.category] ?? ex.category}</span>
                      {ex.amountUsd && <span className="text-xs text-muted-foreground">{fmtUsd(ex.amountUsd)}</span>}
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{timeSince(ex.raisedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-md border font-medium", sevCfg.bg, sevCfg.color)}>
                      {sevCfg.label}
                    </span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-md border font-medium", staCfg.color)}>
                      {staCfg.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <ExceptionDetailSheet exception={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
