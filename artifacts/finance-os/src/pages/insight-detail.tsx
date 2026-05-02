import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle2, Info, ArrowLeft, DollarSign } from "lucide-react"
import { Link, useParams } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchInsight(id: string) {
  const res = await fetch(`${BASE}api/insights/${id}`)
  if (!res.ok) throw new Error("Insight not found")
  return res.json()
}

async function fetchRecommendations() {
  const res = await fetch(`${BASE}api/insights/recommendations/feed`)
  if (!res.ok) throw new Error("Failed to fetch recommendations")
  return res.json()
}

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30">Critical</Badge>
  if (severity === "warning") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">Warning</Badge>
  return <Badge variant="outline">Info</Badge>
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

export function InsightDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id ?? "ins001"

  const insight = useQuery({ queryKey: ["insight-detail", id], queryFn: () => fetchInsight(id) })
  const recs = useQuery({ queryKey: ["recommendations-feed"], queryFn: fetchRecommendations })

  const ins = insight.data?.data
  const recommendations: {
    id: string; title: string; insightId: string; urgency: string; status: string;
    impactEstimate: { netImpactUsd?: number }
  }[] = (recs.data?.data ?? []).filter((r: { insightId: string }) => r.insightId === id)

  if (insight.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted/30 rounded animate-pulse w-48" />
        <div className="h-40 bg-muted/30 rounded animate-pulse" />
      </div>
    )
  }

  if (insight.isError || !ins) {
    return (
      <div className="p-6">
        <Alert className="border-red-500/30 bg-red-500/5">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <AlertDescription className="text-red-300">Insight not found. <Link href="/ai-insights" className="underline">Back to insights.</Link></AlertDescription>
        </Alert>
      </div>
    )
  }

  const narrative = ins.narrative ?? {}

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/ai-insights" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Insights
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <SeverityBadge severity={ins.severity} />
          <Badge variant="outline" className="text-xs capitalize">{ins.insightType?.replace(/_/g, " ")}</Badge>
          <Badge variant="outline" className="text-xs capitalize">{ins.status?.replace(/_/g, " ")}</Badge>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{ins.title}</h1>
        {ins.financialImpactUsd > 0 && (
          <div className="flex items-center gap-1.5 mt-2 text-amber-400">
            <DollarSign className="h-4 w-4" />
            <span className="font-medium">${(ins.financialImpactUsd / 1_000_000).toFixed(1)}M financial exposure</span>
            <span className="text-xs text-muted-foreground">— {ins.financialImpactDescription}</span>
          </div>
        )}
      </div>

      {/* Narrative */}
      {narrative.executiveSummary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-3.5 w-3.5" />
              AI-Generated Narrative
              {!narrative.isApproved && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Pending Review</Badge>}
              {narrative.isApproved && <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Approved</Badge>}
            </CardTitle>
            {narrative.confidence && <CardDescription>Confidence: {Math.round(narrative.confidence * 100)}%</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Executive Summary", value: narrative.executiveSummary },
              { label: "What Changed", value: narrative.whatChanged },
              { label: "Why It Changed", value: narrative.whyItChanged },
              { label: "So What", value: narrative.soWhat },
              { label: "What to Do Next", value: narrative.whatToDoNext },
            ].filter(item => item.value).map((item) => (
              <div key={item.label}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{item.label}</div>
                <p className="text-sm text-foreground/90 leading-relaxed">{item.value}</p>
              </div>
            ))}
            {narrative.confidence && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Narrative confidence</div>
                <ConfidenceBar value={narrative.confidence} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Root cause hypotheses */}
      {ins.rootCauseHypotheses?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Root Cause Hypotheses</CardTitle>
            <CardDescription>Ordered by confidence (highest first)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ins.rootCauseHypotheses
              .slice()
              .sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence)
              .map((hyp: { hypothesis: string; confidence: number; isConfirmed: boolean }, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm flex-1">{hyp.hypothesis}</p>
                    {hyp.isConfirmed ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Confirmed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">Unconfirmed</Badge>
                    )}
                  </div>
                  <ConfidenceBar value={hyp.confidence} />
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Affected metrics */}
      {ins.affectedMetricSlugs?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Affected Metrics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ins.affectedMetricSlugs.map((slug: string) => (
              <Badge key={slug} variant="outline" className="text-xs font-mono">{slug}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Linked recommendations */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Linked Recommendations ({recommendations.length})
        </h2>
        {recs.isLoading ? (
          <div className="space-y-2">{[1].map(i => <div key={i} className="h-14 bg-muted/30 rounded animate-pulse" />)}</div>
        ) : recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recommendations linked to this insight.</p>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <Card key={rec.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{rec.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{rec.urgency} urgency</Badge>
                      <Badge variant="outline" className="text-xs capitalize">{rec.status?.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  {rec.impactEstimate?.netImpactUsd && (
                    <div className="text-sm font-bold text-emerald-400 shrink-0">
                      ${(rec.impactEstimate.netImpactUsd / 1_000_000).toFixed(1)}M
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
