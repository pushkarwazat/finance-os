import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Info, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchModels() {
  const res = await fetch(`${BASE}api/forecasting/models`)
  if (!res.ok) throw new Error("Failed to fetch forecast models")
  return res.json()
}

async function fetchRuns() {
  const res = await fetch(`${BASE}api/forecasting/runs`)
  if (!res.ok) throw new Error("Failed to fetch forecast runs")
  return res.json()
}

async function fetchModelDetail(id: string) {
  const res = await fetch(`${BASE}api/forecasting/models/${id}`)
  if (!res.ok) throw new Error("Failed to fetch model detail")
  return res.json()
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>
  if (status === "draft") return <Badge className="bg-muted text-muted-foreground border-border text-xs">Draft</Badge>
  if (status === "pending_review") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Pending Review</Badge>
  return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

export function ForecastingWorkbenchPage() {
  const models = useQuery({ queryKey: ["forecast-models"], queryFn: fetchModels })
  const runs = useQuery({ queryKey: ["forecast-runs"], queryFn: fetchRuns })
  const modelDetail = useQuery({
    queryKey: ["forecast-model-detail", "fm001"],
    queryFn: () => fetchModelDetail("fm001"),
  })

  const modelList: {
    id: string; name: string; method: string; grain: string; horizonMonths: number;
    activeVersionLabel: string; status: string; approvedBy: string; approvedAt: string
  }[] = models.data?.data ?? []

  const activeModel = modelDetail.data?.data
  const bands: { period: string; low: number; mid: number; high: number; confidenceLevel: number }[] = activeModel?.confidenceBands ?? []
  const drivers: { driverType: string; label: string; value: number; unit: string; contributionPct: number; rationale: string }[] = activeModel?.drivers ?? []
  const runList: { id: string; modelName: string; fiscalPeriod: string; status: string; approvalStatus: string; approvedAt?: string }[] = runs.data?.data ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecasting Workbench</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Driver-based rolling forecasts · Confidence bands · Override audit trail
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300 text-sm">
          All forecast overrides require documented rationale and CFO approval when exceeding $2M.
          Driver assumptions marked <code className="mx-1 text-xs">isLocked=true</code> cannot be modified without Controller authorization.
        </AlertDescription>
      </Alert>

      {/* Model overview */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Forecast Models</h2>
        {models.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1,2].map(i => <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modelList.map((m) => (
              <Card key={m.id} className={m.id === "fm001" ? "border-primary/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{m.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{m.activeVersionLabel}</div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">{m.grain}</Badge>
                        <Badge variant="outline" className="text-xs">{m.horizonMonths}m horizon</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{m.method.replace("_", " ")}</Badge>
                      </div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active model: confidence bands */}
      {bands.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue Forecast: Confidence Bands</CardTitle>
            <CardDescription>FY2026 Revenue Rolling Forecast · 80% confidence interval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bands.map((b) => (
                <div key={b.period} className="grid grid-cols-5 gap-3 items-center">
                  <span className="text-sm font-medium col-span-1">{b.period}</span>
                  <div className="col-span-3 space-y-1">
                    <ConfidenceBar value={b.confidenceLevel} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Low: ${(b.low / 1_000_000).toFixed(1)}M</span>
                      <span className="font-medium text-foreground">Mid: ${(b.mid / 1_000_000).toFixed(1)}M</span>
                      <span>High: ${(b.high / 1_000_000).toFixed(1)}M</span>
                    </div>
                  </div>
                  <div className="col-span-1 text-right">
                    {b.confidenceLevel < 0.65 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 ml-auto" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 ml-auto" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Driver assumptions */}
      {drivers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Driver Assumptions</CardTitle>
            <CardDescription>Key forecast drivers with contribution weights</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {drivers.map((d) => (
                <div key={d.driverType} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {d.unit === "percentage" ? `${(d.value * 100).toFixed(1)}%` :
                         d.unit === "absolute" && d.value >= 1_000_000 ? `$${(d.value / 1_000_000).toFixed(0)}M` :
                         String(d.value)}
                      </span>
                      <Badge variant="outline" className="text-xs">{Math.round(d.contributionPct * 100)}% contribution</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.rationale}</p>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(d.contributionPct * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Recent runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Forecast Runs</CardTitle>
          <CardDescription>All model runs with approval status</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.isLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : runList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No forecast runs found.</p>
          ) : (
            <div className="space-y-3">
              {runList.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                  <div>
                    <div className="text-sm font-medium">{r.modelName}</div>
                    <div className="text-xs text-muted-foreground">{r.fiscalPeriod}</div>
                  </div>
                  <StatusBadge status={r.approvalStatus} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground pt-2">
        → <Link href="/scenarios" className="text-primary hover:underline">Compare baseline / upside / downside scenarios</Link>
      </div>
    </div>
  )
}
