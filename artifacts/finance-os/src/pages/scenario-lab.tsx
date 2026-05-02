import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Info, TrendingUp, TrendingDown } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchScenarioComparison() {
  const res = await fetch(`${BASE}api/forecasting/scenarios/compare?modelId=fm001`)
  if (!res.ok) throw new Error("Failed to fetch scenarios")
  return res.json()
}

function ScenarioTypeBadge({ type }: { type: string }) {
  if (type === "baseline") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">Baseline</Badge>
  if (type === "upside") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Upside</Badge>
  if (type === "downside") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Downside</Badge>
  return <Badge variant="outline" className="text-xs capitalize">{type}</Badge>
}

function ProbabilityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 50 ? "bg-blue-500" : pct >= 25 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  )
}

export function ScenarioLabPage() {
  const comparison = useQuery({ queryKey: ["scenario-comparison"], queryFn: fetchScenarioComparison })

  const data = comparison.data?.data
  const scenarios: {
    id: string; scenarioType: string; name: string; description: string;
    projectedRevenueUsd: number; projectedEbitdaUsd: number; projectedCashUsd: number;
    projectedEbitdaMarginPct: number; confidenceScore: number; probabilityWeight: number;
    narrativeSummary: string;
  }[] = data?.scenarios ?? []
  const comp = data?.comparison
  const sensitivity = data?.sensitivitySummary ?? {}

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scenario Lab</h1>
        <p className="text-sm text-muted-foreground mt-1">
          FY2026 Planning Scenarios · Baseline / Upside / Downside · Sensitivity Analysis
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300 text-sm">
          Probability-weighted revenue across all scenarios is the board-reported planning number.
          Scenario narratives require CFO review before distribution. All scenarios approved on 2026-03-01.
        </AlertDescription>
      </Alert>

      {/* Probability-weighted summary */}
      {comp && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Probability-Weighted View</CardTitle>
            <CardDescription>60% Baseline · 20% Upside · 20% Downside</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Weighted Revenue</div>
                <div className="text-xl font-bold mt-1">${((comp.probabilityWeightedRevenue ?? 0) / 1_000_000).toFixed(1)}M</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Revenue Range</div>
                <div className="text-sm font-medium mt-1">
                  ${(comp.revenueRange.low / 1_000_000).toFixed(0)}M – ${(comp.revenueRange.high / 1_000_000).toFixed(0)}M
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">EBITDA Range</div>
                <div className="text-sm font-medium mt-1">
                  ${(comp.ebitdaRange.low / 1_000_000).toFixed(1)}M – ${(comp.ebitdaRange.high / 1_000_000).toFixed(1)}M
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">EBITDA Margin Range</div>
                <div className="text-sm font-medium mt-1">
                  {(comp.ebitdaMarginRange.low * 100).toFixed(1)}% – {(comp.ebitdaMarginRange.high * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario cards */}
      {comparison.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="h-40 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {scenarios.map((sc) => (
            <Card key={sc.id} className={
              sc.scenarioType === "baseline" ? "border-blue-500/30" :
              sc.scenarioType === "upside" ? "border-emerald-500/30" : "border-red-500/30"
            }>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{sc.name}</CardTitle>
                  <ScenarioTypeBadge type={sc.scenarioType} />
                </div>
                <CardDescription className="text-xs line-clamp-2">{sc.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="text-base font-bold">${(sc.projectedRevenueUsd / 1_000_000).toFixed(1)}M</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">EBITDA</div>
                    <div className="text-base font-bold">${(sc.projectedEbitdaUsd / 1_000_000).toFixed(1)}M</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">EBITDA Margin</div>
                    <div className="text-sm font-medium">{(sc.projectedEbitdaMarginPct * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Cash</div>
                    <div className="text-sm font-medium">${(sc.projectedCashUsd / 1_000_000).toFixed(0)}M</div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Probability</span>
                  </div>
                  <ProbabilityBar value={sc.probabilityWeight} />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                  <ProbabilityBar value={sc.confidenceScore} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{sc.narrativeSummary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Sensitivity table */}
      {Object.keys(sensitivity).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sensitivity Analysis</CardTitle>
            <CardDescription>Impact of single-driver changes on revenue and EBITDA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground font-medium pb-2 border-b border-border">
                <span>Driver Shock</span>
                <span>Revenue Impact</span>
                <span>EBITDA Impact</span>
              </div>
              {Object.entries(sensitivity).map(([key, val]) => {
                const v = val as { revenueImpact: number; ebitdaImpact: number }
                return (
                  <div key={key} className="grid grid-cols-3 gap-4 items-center py-1">
                    <span className="text-xs font-medium capitalize">{key.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-1">
                      {v.revenueImpact < 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> : <TrendingUp className="h-3 w-3 text-emerald-400" />}
                      <span className={`text-xs ${v.revenueImpact < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        ${(Math.abs(v.revenueImpact) / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {v.ebitdaImpact < 0 ? <TrendingDown className="h-3 w-3 text-red-400" /> : <TrendingUp className="h-3 w-3 text-emerald-400" />}
                      <span className={`text-xs ${v.ebitdaImpact < 0 ? "text-red-400" : "text-emerald-400"}`}>
                        ${(Math.abs(v.ebitdaImpact) / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
