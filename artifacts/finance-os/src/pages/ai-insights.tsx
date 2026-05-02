import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, Eye, TrendingDown, DollarSign } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchInsights() {
  const res = await fetch(`${BASE}api/insights/feed`)
  if (!res.ok) throw new Error("Failed to fetch insights")
  return res.json()
}

async function fetchAlerts() {
  const res = await fetch(`${BASE}api/insights/alerts`)
  if (!res.ok) throw new Error("Failed to fetch alerts")
  return res.json()
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Critical</Badge>
  if (severity === "warning") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Warning</Badge>
  return <Badge variant="outline" className="text-xs">Info</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-red-500/15 text-red-400 border-red-500/30",
    under_investigation: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    dismissed: "bg-muted text-muted-foreground border-border",
  }
  const label: Record<string, string> = {
    open: "Open",
    under_investigation: "Investigating",
    resolved: "Resolved",
    dismissed: "Dismissed",
  }
  return <Badge className={`${map[status] ?? "bg-muted text-muted-foreground"} text-xs`}>{label[status] ?? status}</Badge>
}

function InsightTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    anomaly: "bg-red-500/15 text-red-400 border-red-500/30",
    margin_leakage: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    cost_growth: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    trend_change: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    pricing_opportunity: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  }
  const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return <Badge className={`${map[type] ?? "bg-muted text-muted-foreground"} text-xs`}>{label}</Badge>
}

export function AiInsightsPage() {
  const insights = useQuery({ queryKey: ["insights-feed"], queryFn: fetchInsights })
  const alerts = useQuery({ queryKey: ["insights-alerts"], queryFn: fetchAlerts })

  const insightList: {
    id: string; insightType: string; severity: string; status: string; title: string;
    summary: string; financialImpactUsd: number; affectedMetricSlugs: string[];
    recommendationIds: string[]; createdAt: string
  }[] = insights.data?.data ?? []

  const summary = insights.data?.summary
  const alertList: { id: string; title: string; description: string; severity: string; requiresAction: boolean; assignedTo: string }[] = alerts.data?.data?.filter((a: { isResolved: boolean }) => !a.isResolved) ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Insights Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anomaly detection · Margin leakage signals · AI-generated root cause analysis
        </p>
      </div>

      {summary && (summary.critical > 0 || summary.warning > 0) && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-300 text-sm">
            {summary.openCount} open insight{summary.openCount !== 1 ? "s" : ""} with
            total financial exposure of <strong>${(summary.totalFinancialImpactUsd / 1_000_000).toFixed(1)}M</strong>.
            All root cause analyses and recommendations require human review before action.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Insights</div><div className="text-2xl font-bold mt-1">{summary.total}</div></CardContent></Card>
          <Card className={summary.critical > 0 ? "border-red-500/30" : ""}><CardContent className="p-4"><div className="text-xs text-muted-foreground">Critical</div><div className={`text-2xl font-bold mt-1 ${summary.critical > 0 ? "text-red-400" : ""}`}>{summary.critical}</div></CardContent></Card>
          <Card className={summary.warning > 0 ? "border-amber-500/30" : ""}><CardContent className="p-4"><div className="text-xs text-muted-foreground">Warnings</div><div className={`text-2xl font-bold mt-1 ${summary.warning > 0 ? "text-amber-400" : ""}`}>{summary.warning}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Financial Exposure</div><div className="text-xl font-bold mt-1">${(summary.totalFinancialImpactUsd / 1_000_000).toFixed(1)}M</div></CardContent></Card>
        </div>
      )}

      {/* Active alerts */}
      {alertList.length > 0 && (
        <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Active Business Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertList.map((a) => (
              <div key={a.id} className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <div className="text-sm font-medium text-amber-300">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                <div className="text-xs text-muted-foreground mt-1">Assigned: {a.assignedTo}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Insight feed */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Insight Feed</h2>
        {insights.isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="h-24 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}</div>
        ) : insightList.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No insights found.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {insightList.map((ins) => (
              <Card key={ins.id} className={ins.severity === "warning" ? "border-amber-500/20" : ins.severity === "critical" ? "border-red-500/20" : ""}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <SeverityBadge severity={ins.severity} />
                        <InsightTypeBadge type={ins.insightType} />
                        <StatusBadge status={ins.status} />
                      </div>
                      <Link href={`/insights/${ins.id}`} className="text-sm font-medium hover:text-primary line-clamp-2">{ins.title}</Link>
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{ins.summary}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingDown className="h-3 w-3" />
                          <span>{ins.affectedMetricSlugs.join(", ")}</span>
                        </div>
                        {ins.recommendationIds.length > 0 && (
                          <Link href="/recommendations" className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <CheckCircle2 className="h-3 w-3" />
                            {ins.recommendationIds.length} recommendation{ins.recommendationIds.length > 1 ? "s" : ""}
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-amber-400">
                        <DollarSign className="h-3.5 w-3.5" />
                        <span className="text-sm font-bold">{(ins.financialImpactUsd / 1_000_000).toFixed(1)}M</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">exposure</div>
                      <Link href={`/insights/${ins.id}`} className="flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                        <Eye className="h-3 w-3" /> Detail
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
