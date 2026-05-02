import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, TrendingDown } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchMarginLeakage() {
  const res = await fetch(`${BASE}api/insights/margin-leakage`)
  if (!res.ok) throw new Error("Failed to fetch margin leakage")
  return res.json()
}

async function fetchKpis() {
  const res = await fetch(`${BASE}api/reporting/kpi-cards`)
  if (!res.ok) throw new Error("Failed to fetch KPIs")
  return res.json()
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

export function MarginOptimizationPage() {
  const leakage = useQuery({ queryKey: ["margin-leakage"], queryFn: fetchMarginLeakage })
  const kpis = useQuery({ queryKey: ["reporting-kpis"], queryFn: fetchKpis })

  const leakageList: {
    id: string; period: string; category: string; description: string;
    annualizedLeakageUsd: number; rootCause: string; recoveryPotentialUsd: number; confidence: number
  }[] = leakage.data?.data ?? []

  const leakageSummary = leakage.data?.summary
  const grossMarginKpi = kpis.data?.data?.find((k: { metricSlug: string }) => k.metricSlug === "gross_margin")
  const ebitdaKpi = kpis.data?.data?.find((k: { metricSlug: string }) => k.metricSlug === "ebitda_margin")

  const totalLeakage = leakageSummary?.totalAnnualizedLeakageUsd ?? 0
  const totalRecovery = leakageSummary?.totalRecoveryPotentialUsd ?? 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Margin Optimization Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Margin leakage detection · Recovery opportunity sizing · AI-driven root cause
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          {leakageList.length} active margin leakage signal{leakageList.length !== 1 ? "s" : ""} identified.
          Total annualized leakage: <strong>${(totalLeakage / 1_000_000).toFixed(1)}M</strong>.
          Recovery potential: <strong>${(totalRecovery / 1_000_000).toFixed(1)}M</strong>.
          All findings require CFO review before action.
        </AlertDescription>
      </Alert>

      {/* Margin KPI snapshot */}
      {(grossMarginKpi || ebitdaKpi) && (
        <div className="grid grid-cols-2 gap-4">
          {[grossMarginKpi, ebitdaKpi].filter(Boolean).map((kpi: { title: string; value: number; variancePct: number; comparisonLabel: string }) => (
            <Card key={kpi.title} className="border-amber-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-xs text-muted-foreground">{kpi.title}</span>
                </div>
                <div className="text-xl font-bold">{(kpi.value * 100).toFixed(1)}%</div>
                <div className="text-xs text-red-400 mt-0.5">
                  {(kpi.variancePct * 100).toFixed(1)}% {kpi.comparisonLabel}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Leakage Signals</div>
            <div className="text-2xl font-bold mt-1">{leakageList.length}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Annualized Leakage</div>
            <div className="text-xl font-bold text-red-400 mt-1">${(totalLeakage / 1_000_000).toFixed(1)}M</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Recovery Potential</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">${(totalRecovery / 1_000_000).toFixed(1)}M</div>
          </CardContent>
        </Card>
      </div>

      {/* Leakage items */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Margin Leakage Signals</h2>
        {leakage.isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Card key={i}><CardContent className="p-4"><div className="h-20 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}</div>
        ) : (
          <div className="space-y-4">
            {leakageList.map((item) => (
              <Card key={item.id} className="border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs capitalize">{item.category.replace(/_/g, " ")}</Badge>
                        <span className="text-xs text-muted-foreground">{item.period}</span>
                      </div>
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.rootCause}</p>
                      <div className="mt-3 space-y-1">
                        <div className="text-xs text-muted-foreground">Confidence</div>
                        <ConfidenceBar value={item.confidence} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <div>
                        <div className="text-xs text-muted-foreground">Annualized Leak</div>
                        <div className="text-sm font-bold text-red-400">${(item.annualizedLeakageUsd / 1_000_000).toFixed(1)}M</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Recovery</div>
                        <div className="text-sm font-bold text-emerald-400">${(item.recoveryPotentialUsd / 1_000_000).toFixed(1)}M</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        → <Link href="/cost-reduction" className="text-primary hover:underline">View cost reduction opportunities</Link>
        <span className="mx-2">·</span>
        <Link href="/recommendations" className="text-primary hover:underline">View AI recommendations</Link>
      </div>
    </div>
  )
}
