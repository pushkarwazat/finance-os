import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, GitMerge, CheckCircle2, Clock, XCircle } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchConsolidationRuns() {
  const res = await fetch(`${BASE}api/consolidation/runs`)
  if (!res.ok) throw new Error("Failed to fetch consolidation runs")
  return res.json()
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
    pending_ic_resolution: { label: "IC Resolution", className: "bg-red-500/20 text-red-400 border-red-500/30", icon: <XCircle className="h-3 w-3" /> },
    pending_controller: { label: "Controller Review", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <Clock className="h-3 w-3" /> },
    pending_cfo: { label: "CFO Sign-off", className: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: <Clock className="h-3 w-3" /> },
    draft: { label: "Draft", className: "border-border text-muted-foreground", icon: null },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle className="h-3 w-3" /> },
  }
  const cfg = map[status] ?? map["draft"]
  return (
    <Badge className={`text-xs gap-1 ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

export function ConsolidationPage() {
  const runs = useQuery({ queryKey: ["consolidation-runs"], queryFn: fetchConsolidationRuns })
  const runList = runs.data?.data ?? []

  const approvedRun = runList.find((r: { status: string }) => r.status === "approved")
  const pendingRun = runList.find((r: { status: string }) => r.status === "pending_ic_resolution")

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Consolidation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Multi-entity consolidation · Intercompany elimination · Group P&amp;L sign-off
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          All intercompany elimination entries are AI-drafted and require dual Controller + CFO approval.
          Consolidation runs with unresolved IC mismatches above $10K cannot be approved.
        </AlertDescription>
      </Alert>

      {/* Active IC mismatch alert */}
      {pendingRun && (
        <Alert className="border-red-500/30 bg-red-500/5">
          <XCircle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300 text-sm">
            <span className="font-medium">{pendingRun.fiscalPeriod}</span> consolidation run has unresolved
            intercompany mismatches totalling{" "}
            <span className="font-medium">${(pendingRun.totalUnmatchedIcUsd ?? 0).toLocaleString()}</span>.
            Human resolution required before this run can be approved.
          </AlertDescription>
        </Alert>
      )}

      {/* Latest approved consolidation */}
      {approvedRun && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <GitMerge className="h-4 w-4" />
                  {approvedRun.fiscalPeriod} — Consolidated Group P&amp;L
                </CardTitle>
                <CardDescription>
                  {approvedRun.entityIds?.length} entities · CFO signed off {approvedRun.cfoSignedOffAt?.split("T")[0]}
                </CardDescription>
              </div>
              <RunStatusBadge status={approvedRun.status} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Consol. Revenue</p>
                <p className="text-lg font-semibold">${((approvedRun.consolidatedRevenueUsd ?? 0) / 1e6).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Consol. EBITDA</p>
                <p className="text-lg font-semibold">${((approvedRun.consolidatedEbitdaUsd ?? 0) / 1e6).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Income</p>
                <p className="text-lg font-semibold">${((approvedRun.consolidatedNetIncomeUsd ?? 0) / 1e6).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">IC Eliminations</p>
                <p className="text-lg font-semibold">${((approvedRun.totalEliminationsUsd ?? 0) / 1e6).toFixed(1)}M</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Controller: {approvedRun.controllerApprovedBy} · CFO: {approvedRun.cfoSignedOffBy}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consolidation Runs</CardTitle>
          <CardDescription>All consolidation runs across all periods</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {runs.isError && <p className="text-sm text-red-400">Failed to load consolidation runs.</p>}
          <div className="space-y-2">
            {runList.map((run: {
              id: string
              fiscalPeriod: string
              status: string
              entityIds?: string[]
              totalUnmatchedIcUsd: number
              totalEliminationsUsd: number
              runStartedAt: string
            }) => (
              <div key={run.id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{run.fiscalPeriod}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {run.entityIds?.length ?? 0} entities
                  </span>
                  {run.totalUnmatchedIcUsd > 0 && (
                    <span className="text-red-400 ml-2 text-xs">
                      IC mismatch: ${run.totalUnmatchedIcUsd.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{run.runStartedAt.split("T")[0]}</span>
                  <RunStatusBadge status={run.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
