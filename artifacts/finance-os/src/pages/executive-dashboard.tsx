import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchDashboard() {
  const res = await fetch(`${BASE}api/reporting/dashboard`)
  if (!res.ok) throw new Error("Failed to fetch dashboard")
  return res.json()
}

async function fetchInsightFeed() {
  const res = await fetch(`${BASE}api/insights/feed?limit=3`)
  if (!res.ok) throw new Error("Failed to fetch insights")
  return res.json()
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "favourable") return <TrendingUp className="h-3 w-3 text-emerald-400" />
  if (direction === "unfavourable") return <TrendingDown className="h-3 w-3 text-red-400" />
  return <Minus className="h-3 w-3 text-muted-foreground" />
}

function formatValue(value: number, format: string) {
  if (format === "currency") {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }
  if (format === "percentage") return `${(value * 100).toFixed(1)}%`
  if (format === "days") return `${value}d`
  if (format === "count") return value.toFixed(1)
  return String(value)
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Critical</Badge>
  if (severity === "warning") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Warning</Badge>
  return <Badge variant="outline" className="text-xs">Info</Badge>
}

export function ExecutiveDashboardPage() {
  const dashboard = useQuery({ queryKey: ["reporting-dashboard"], queryFn: fetchDashboard })
  const insights = useQuery({ queryKey: ["insights-feed-summary"], queryFn: fetchInsightFeed })

  const kpiCards: {
    title: string; metricSlug: string; value: number; format: string;
    variancePct: number; comparisonLabel: string; trendDirection: string; isMaterial: boolean
  }[] = dashboard.data?.data?.kpiCards ?? []
  const insightList: { id: string; title: string; severity: string; financialImpactUsd: number; insightType: string }[] = insights.data?.data ?? []
  const summary = insights.data?.summary

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CFO-level overview · Q1 FY2026 · AI Insights + KPI Scorecard
        </p>
      </div>

      {summary && (summary.critical > 0 || summary.warning > 0) && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300 text-sm">
            {summary.critical > 0 && <span>{summary.critical} critical insight{summary.critical > 1 ? "s" : ""} require immediate action. </span>}
            {summary.warning > 0 && <span>{summary.warning} warning{summary.warning > 1 ? "s" : ""} flagged. </span>}
            Total financial exposure: ${((summary.totalFinancialImpactUsd ?? 0) / 1_000_000).toFixed(1)}M.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI cards */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Key Performance Indicators — Q1 FY2026</h2>
        {dashboard.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted/30 rounded animate-pulse" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kpiCards.map((kpi) => (
              <Card key={kpi.metricSlug} className={kpi.isMaterial && kpi.trendDirection === "unfavourable" ? "border-amber-500/30" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground truncate">{kpi.title}</span>
                    <TrendIcon direction={kpi.trendDirection} />
                  </div>
                  <div className="text-lg font-bold">{formatValue(kpi.value, kpi.format)}</div>
                  <div className={`text-xs mt-1 ${kpi.trendDirection === "favourable" ? "text-emerald-400" : kpi.trendDirection === "unfavourable" ? "text-red-400" : "text-muted-foreground"}`}>
                    {kpi.variancePct >= 0 ? "+" : ""}{(kpi.variancePct * 100).toFixed(1)}% {kpi.comparisonLabel}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* AI Insights feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Top AI Insights</h2>
          <Link href="/ai-insights" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        {insights.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Card key={i}><CardContent className="p-4"><div className="h-10 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}
          </div>
        ) : (
          <div className="space-y-3">
            {insightList.map((ins) => (
              <Card key={ins.id} className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link href={`/insights/${ins.id}`} className="text-sm font-medium hover:text-primary line-clamp-1">{ins.title}</Link>
                      <div className="flex items-center gap-2 mt-1">
                        <SeverityBadge severity={ins.severity} />
                        <span className="text-xs text-muted-foreground capitalize">{ins.insightType.replace("_", " ")}</span>
                      </div>
                    </div>
                    <div className="text-sm font-medium text-amber-400 shrink-0">
                      ${(ins.financialImpactUsd / 1_000_000).toFixed(1)}M
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Reporting Center", href: "/reporting", desc: "Reports & board packs" },
            { label: "Forecasting", href: "/forecasting", desc: "Rolling forecasts" },
            { label: "Scenario Lab", href: "/scenarios", desc: "Plan comparisons" },
            { label: "Recommendations", href: "/recommendations", desc: "AI action queue" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
