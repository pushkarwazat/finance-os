import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info, Zap, Clock } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchCostReduction() {
  const res = await fetch(`${BASE}api/insights/cost-reduction`)
  if (!res.ok) throw new Error("Failed to fetch cost reduction")
  return res.json()
}

function ImplementationBadge({ impl }: { impl: string }) {
  if (impl === "quick_win") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <Zap className="h-3 w-3" /> Quick Win
    </Badge>
  )
  if (impl === "medium_term") return (
    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs gap-1">
      <Clock className="h-3 w-3" /> Medium Term
    </Badge>
  )
  return <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs">Strategic</Badge>
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 65 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}% confidence</span>
    </div>
  )
}

export function CostReductionPage() {
  const costData = useQuery({ queryKey: ["cost-reduction"], queryFn: fetchCostReduction })

  const candidates: {
    id: string; category: string; lineItem: string; department: string;
    currentAnnualSpendUsd: number; benchmarkSpendUsd: number;
    potentialSavingsUsd: number; potentialSavingsPct: number;
    implementation: string; confidence: number
  }[] = costData.data?.data ?? []

  const summary = costData.data?.summary

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cost Reduction Opportunities</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-identified cost reduction candidates · Benchmarked to peer spending norms
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300 text-sm">
          Cost reduction estimates are benchmarked against industry peers.
          Quick wins can be actioned immediately; medium-term items require planning.
          All savings are unaudited estimates — confirm with vendor/legal before committing.
        </AlertDescription>
      </Alert>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Opportunities</div>
              <div className="text-2xl font-bold mt-1">{summary.count}</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total Potential Savings</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">${(summary.totalPotentialSavingsUsd / 1_000_000).toFixed(1)}M</div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Quick Wins ({summary.quickWinCount})</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">${(summary.quickWinSavingsUsd / 1_000).toFixed(0)}K</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Avg Saving %</div>
              <div className="text-xl font-bold mt-1">
                {candidates.length > 0 ? (candidates.reduce((s, c) => s + c.potentialSavingsPct, 0) / candidates.length * 100).toFixed(1) : "—"}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Candidates */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Cost Reduction Candidates</h2>
        {costData.isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="h-20 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}</div>
        ) : (
          <div className="space-y-4">
            {candidates
              .sort((a, b) => b.potentialSavingsUsd - a.potentialSavingsUsd)
              .map((c) => (
                <Card key={c.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <ImplementationBadge impl={c.implementation} />
                          <Badge variant="outline" className="text-xs capitalize">{c.department.replace(/_/g, " ")}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{c.category.replace(/_/g, " ")}</Badge>
                        </div>
                        <p className="text-sm font-medium">{c.lineItem}</p>
                        <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">Current spend:</span>
                            <span className="ml-1 font-medium">${(c.currentAnnualSpendUsd / 1_000).toFixed(0)}K/yr</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Benchmark:</span>
                            <span className="ml-1 font-medium">${(c.benchmarkSpendUsd / 1_000).toFixed(0)}K/yr</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <ConfidenceBar value={c.confidence} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-bold text-emerald-400">${(c.potentialSavingsUsd / 1_000).toFixed(0)}K</div>
                        <div className="text-xs text-muted-foreground">savings/yr</div>
                        <div className="text-xs text-emerald-400 mt-0.5">({(c.potentialSavingsPct * 100).toFixed(1)}%)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground pt-2">
        → <Link href="/recommendations" className="text-primary hover:underline">View full recommendation queue</Link>
      </div>
    </div>
  )
}
