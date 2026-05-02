import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ShieldCheck, ShieldAlert, Clock, CheckCircle2, XCircle,
  ChevronRight, Loader2, AlertTriangle, DollarSign, User, Calendar
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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
interface ApprovalStep {
  id: string
  workflowRunId: string
  gateId: string
  displayName: string
  description: string
  requiredLevel: "self_serve" | "controller" | "cfo" | "audit_committee"
  requiredRoles: string[]
  status: "pending" | "approved" | "rejected" | "escalated" | "expired" | "auto_approved"
  decidedBy: string | null
  decision: "approved" | "rejected" | null
  decisionNote?: string
  materialityAmount?: number
  materialityThreshold?: number
  evidenceIds: string[]
  expiresAt: string | null
  createdAt: string
  decidedAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  self_serve:      { label: "Self-Serve",      color: "bg-muted text-muted-foreground border-border" },
  controller:      { label: "Controller",      color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  cfo:             { label: "CFO",             color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  audit_committee: { label: "Audit Committee", color: "bg-red-500/15 text-red-400 border-red-500/30" },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:      { label: "Pending",      color: "bg-amber-500/15 text-amber-400 border-amber-500/30",        icon: Clock },
  approved:     { label: "Approved",     color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  rejected:     { label: "Rejected",     color: "bg-red-500/15 text-red-400 border-red-500/30",             icon: XCircle },
  escalated:    { label: "Escalated",    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",    icon: AlertTriangle },
  expired:      { label: "Expired",      color: "bg-muted text-muted-foreground border-border",               icon: Clock },
  auto_approved:{ label: "Auto-Approved",color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: ShieldCheck },
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

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium", cfg.color)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Approval detail panel ────────────────────────────────────────────────────
function ApprovalDetailSheet({
  approval,
  open,
  onClose,
}: {
  approval: ApprovalStep | null
  open: boolean
  onClose: () => void
}) {
  const [note, setNote] = useState("")
  const [acting, setActing] = useState(false)
  const queryClient = useQueryClient()

  const decideMutation = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      apiFetch(`/workflows/approvals/${approval!.id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision, decidedBy: "J. Davies (Controller)", note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] })
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
      setNote("")
      setActing(false)
      onClose()
    },
  })

  if (!approval) return null
  const levelCfg = LEVEL_CONFIG[approval.requiredLevel] ?? LEVEL_CONFIG.controller
  const isMaterialityBreach =
    approval.materialityAmount !== undefined &&
    approval.materialityThreshold !== undefined &&
    approval.materialityAmount > approval.materialityThreshold

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[480px] max-w-full overflow-y-auto bg-background border-border" side="right">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold text-foreground">{approval.displayName}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <StatusBadge status={approval.status} />
            <span className={cn("text-xs px-2 py-0.5 rounded-md border font-medium", levelCfg.color)}>
              {levelCfg.label} required
            </span>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{approval.description}</p>

          {isMaterialityBreach && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-3">
              <DollarSign className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-400">Materiality Threshold Exceeded</p>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Amount: {fmtUsd(approval.materialityAmount!)} vs threshold: {fmtUsd(approval.materialityThreshold!)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Required Roles", value: approval.requiredRoles.join(", "), icon: User },
              { label: "Created",        value: timeSince(approval.createdAt),      icon: Calendar },
              approval.materialityAmount && { label: "Amount at Stake",  value: fmtUsd(approval.materialityAmount), icon: DollarSign },
              approval.expiresAt && { label: "Expires",       value: timeSince(approval.expiresAt),   icon: Clock },
            ].filter(Boolean).map((item) => {
              if (!item) return null
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                  <p className="text-sm font-medium text-foreground">{item.value}</p>
                </div>
              )
            })}
          </div>

          {approval.status === "pending" && (
            <>
              {!acting ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setActing(true)}>
                  Review &amp; Decide
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium text-foreground">Decision Note (optional)</p>
                  <Textarea
                    placeholder="Add a note for the audit trail…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="text-sm bg-background border-border resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate("approved")}
                    >
                      {decideMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5"
                      disabled={decideMutation.isPending}
                      onClick={() => decideMutation.mutate("rejected")}
                    >
                      {decideMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Reject
                    </Button>
                  </div>
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setActing(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {approval.decision && (
            <div className={cn("rounded-lg border p-3", approval.decision === "approved" ? "border-emerald-500/30 bg-emerald-500/10" : "border-red-500/30 bg-red-500/10")}>
              <p className={cn("text-xs font-medium", approval.decision === "approved" ? "text-emerald-400" : "text-red-400")}>
                {approval.decision === "approved" ? "Approved" : "Rejected"} by {approval.decidedBy}
              </p>
              {approval.decisionNote && (
                <p className="text-xs text-muted-foreground mt-1">{approval.decisionNote}</p>
              )}
              {approval.decidedAt && (
                <p className="text-xs text-muted-foreground/60 mt-1">{timeSince(approval.decidedAt)}</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ApprovalsPage() {
  const [selected, setSelected] = useState<ApprovalStep | null>(null)
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending")

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-approvals", filter],
    queryFn: () => apiFetch(`/workflows/approvals${filter !== "all" ? `?status=${filter}` : ""}`),
    refetchInterval: 10000,
  })

  const approvals: ApprovalStep[] = data?.data ?? []
  const pending = approvals.filter((a) => a.status === "pending").length
  const approved = approvals.filter((a) => a.status === "approved").length
  const rejected = approvals.filter((a) => a.status === "rejected").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every agent recommendation requires human sign-off before execution.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending",  value: pending,  icon: Clock,         color: "text-amber-400"   },
          { label: "Approved", value: approved, icon: CheckCircle2,  color: "text-emerald-400" },
          { label: "Rejected", value: rejected, icon: XCircle,       color: "text-red-400"     },
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

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-2">
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
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

      {/* ── Approvals list ── */}
      <Card className="bg-card border-border overflow-hidden">
        <CardHeader className="px-4 py-3 border-b border-border">
          <CardTitle className="text-sm font-medium">
            {filter === "pending" ? "Pending Approvals" : "Approval History"}
          </CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {filter === "pending" ? "No pending approvals." : "No approvals found."}
            </p>
          </div>
        ) : (
          <div>
            {approvals.map((ap) => {
              const levelCfg = LEVEL_CONFIG[ap.requiredLevel] ?? LEVEL_CONFIG.controller
              return (
                <button
                  key={ap.id}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/50 last:border-0 text-left group"
                  onClick={() => setSelected(ap)}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ap.displayName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", levelCfg.color)}>{levelCfg.label}</span>
                      {ap.materialityAmount && (
                        <span className="text-xs text-muted-foreground">{fmtUsd(ap.materialityAmount)}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{timeSince(ap.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={ap.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <ApprovalDetailSheet approval={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
