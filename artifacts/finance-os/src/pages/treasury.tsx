import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, ShieldAlert, ShieldCheck, Eye, Banknote, TrendingDown } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchLatestPosition() {
  const res = await fetch(`${BASE}api/treasury/positions/latest`)
  if (!res.ok) throw new Error("Failed to fetch treasury position")
  return res.json()
}

async function fetchCovenants() {
  const res = await fetch(`${BASE}api/treasury/covenants`)
  if (!res.ok) throw new Error("Failed to fetch covenants")
  return res.json()
}

function AlertLevelBadge({ level }: { level: string }) {
  if (level === "critical") return (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
      <ShieldAlert className="h-3 w-3" /> Critical
    </Badge>
  )
  if (level === "warning") return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
      <AlertTriangle className="h-3 w-3" /> Warning
    </Badge>
  )
  return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
      <ShieldCheck className="h-3 w-3" /> OK
    </Badge>
  )
}

function CovenantStatusBadge({ status }: { status: string }) {
  if (status === "breach") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Breach</Badge>
  if (status === "watch") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs gap-1"><Eye className="h-3 w-3" />Watch</Badge>
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Compliant</Badge>
}

export function TreasuryPage() {
  const position = useQuery({ queryKey: ["treasury-position"], queryFn: fetchLatestPosition })
  const covenants = useQuery({ queryKey: ["treasury-covenants"], queryFn: fetchCovenants })

  const pos = position.data?.data
  const covenantSummary = covenants.data?.summary
  const covenantList = covenants.data?.data ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Treasury &amp; Cash</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cash position · Runway · Working capital · Covenant monitoring
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          All sweep instructions are drafts only. No bank action is taken without dual Controller + CFO approval
          and manual execution in the treasury portal.
        </AlertDescription>
      </Alert>

      {/* Cash position KPIs */}
      {pos && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Banknote className="h-3 w-3" /> Unrestricted Cash
              </p>
              <p className="text-2xl font-semibold mt-1">
                ${(pos.totalUnrestrictedCashUsd / 1e6).toFixed(1)}M
              </p>
              <p className="text-xs text-muted-foreground mt-1">As of {pos.asOfDate}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Cash Runway</p>
              <p className="text-2xl font-semibold mt-1">
                {pos.runwayMonths?.toFixed(1) ?? "—"} mo
              </p>
              <p className={`text-xs mt-1 ${(pos.runwayMonths ?? 99) < 12 ? "text-amber-400" : "text-muted-foreground"}`}>
                {(pos.runwayMonths ?? 0) < 6 ? "Critical" : (pos.runwayMonths ?? 0) < 12 ? "Warning" : "Healthy"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Monthly Burn
              </p>
              <p className="text-2xl font-semibold mt-1">
                ${((pos.netMonthlyBurnUsd ?? 0) / 1e6).toFixed(2)}M
              </p>
              <p className="text-xs text-muted-foreground mt-1">3-mo trailing avg</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Alert Level</p>
              <div className="mt-2">
                <AlertLevelBadge level={pos.alertLevel} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {position.isLoading && <p className="text-sm text-muted-foreground">Loading cash position…</p>}
      {position.isError && <p className="text-sm text-red-400">Failed to load cash position.</p>}

      {/* Covenant monitoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Covenant Monitoring</CardTitle>
              <CardDescription>Debt covenant compliance as of last test date</CardDescription>
            </div>
            {covenantSummary && (
              <Badge
                className={
                  covenantSummary.overallStatus === "breach"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : covenantSummary.overallStatus === "watch_list"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                }
              >
                {covenantSummary.overallStatus === "all_compliant"
                  ? "All Compliant"
                  : covenantSummary.overallStatus === "watch_list"
                  ? `${covenantSummary.watchCount} On Watch`
                  : `${covenantSummary.breachCount} Breach`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {covenants.isLoading && <p className="text-sm text-muted-foreground">Loading covenants…</p>}
          <div className="space-y-3">
            {covenantList.map((c: {
              id: string
              covenantName: string
              metricSlug: string
              currentValue: number
              thresholdValue: number
              headroomPct: number
              status: string
              testDate: string
            }) => (
              <div key={c.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{c.covenantName}</p>
                  <CovenantStatusBadge status={c.status} />
                </div>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Metric</p>
                    <p className="font-medium font-mono">{c.metricSlug}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-medium">{c.currentValue.toFixed(2)}x</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Threshold</p>
                    <p className="font-medium">{c.thresholdValue.toFixed(2)}x</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Headroom</p>
                    <p className={`font-medium ${c.headroomPct < 0.10 ? "text-amber-400" : "text-emerald-400"}`}>
                      {(c.headroomPct * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Test date: {c.testDate}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
