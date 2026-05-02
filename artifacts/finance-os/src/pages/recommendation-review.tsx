import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle2, XCircle, Clock, DollarSign, ChevronDown, ChevronRight } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchRecommendations() {
  const res = await fetch(`${BASE}api/insights/recommendations/feed`)
  if (!res.ok) throw new Error("Failed to fetch recommendations")
  return res.json()
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === "immediate") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs gap-1"><AlertTriangle className="h-3 w-3" /> Immediate</Badge>
  if (urgency === "high") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">High</Badge>
  if (urgency === "medium") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">Medium</Badge>
  return <Badge variant="outline" className="text-xs capitalize">{urgency}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending_review") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1"><Clock className="h-3 w-3" /> Pending Review</Badge>
  if (status === "approved") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>
  if (status === "rejected") return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>
  if (status === "deferred") return <Badge variant="outline" className="text-xs">Deferred</Badge>
  if (status === "implemented") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Implemented</Badge>
  return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>
}

export function RecommendationReviewPage() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({})

  const recs = useQuery({ queryKey: ["recommendations-review"], queryFn: fetchRecommendations })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const res = await fetch(`${BASE}api/insights/recommendations/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewedBy: "cfo@company.com" }),
      })
      if (!res.ok) throw new Error("Failed to review recommendation")
      return res.json()
    },
    onMutate: ({ id, action }) => {
      const statusMap: Record<string, string> = { approve: "approved", reject: "rejected", defer: "deferred" }
      setOptimisticStatuses((prev) => ({ ...prev, [id]: statusMap[action] ?? action }))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recommendations-review"] }),
  })

  const recList: {
    id: string; title: string; summary: string; businessRationale: string;
    insightId: string; category: string; urgency: string; status: string;
    confidence: number; nextActions: string[];
    impactEstimate: { netImpactUsd?: number; annualizedSavingsUsd?: number; revenueUpliftUsd?: number; confidenceLevel?: string; paybackPeriodMonths?: number }
    requiresApproval: boolean; recommendedOwner: string;
    affectedMetricSlugs: string[]
  }[] = recs.data?.data ?? []

  const summary = recs.data?.summary

  const getStatus = (rec: { id: string; status: string }) => optimisticStatuses[rec.id] ?? rec.status

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recommendation Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated recommendations · Approve / reject / defer · Action tracking
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          All recommendations are AI-generated from detected anomalies and margin signals.
          Human review is required before any action. High-urgency recommendations require CFO approval.
        </AlertDescription>
      </Alert>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold mt-1">{summary.total}</div></CardContent></Card>
          <Card className="border-amber-500/30"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending Review</div><div className="text-2xl font-bold text-amber-400 mt-1">{summary.pendingReview}</div></CardContent></Card>
          <Card className="border-red-500/30"><CardContent className="p-4"><div className="text-xs text-muted-foreground">High Urgency</div><div className="text-2xl font-bold text-red-400 mt-1">{summary.highUrgency}</div></CardContent></Card>
          <Card className="border-emerald-500/30"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Net Impact</div><div className="text-lg font-bold text-emerald-400 mt-1">${((summary.totalNetImpactUsd ?? 0) / 1_000_000).toFixed(1)}M</div></CardContent></Card>
        </div>
      )}

      {/* Recommendation queue */}
      <div className="space-y-4">
        {recs.isLoading ? (
          [1,2,3,4].map(i => <Card key={i}><CardContent className="p-4"><div className="h-20 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)
        ) : recList.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No recommendations in queue.</CardContent></Card>
        ) : (
          recList.map((rec) => {
            const status = getStatus(rec)
            const isOpen = expanded === rec.id
            const isPending = status === "pending_review"
            const impact = rec.impactEstimate
            const netImpact = impact?.netImpactUsd ?? impact?.annualizedSavingsUsd ?? impact?.revenueUpliftUsd ?? 0

            return (
              <Card key={rec.id} className={
                status === "approved" ? "border-emerald-500/20" :
                status === "rejected" ? "border-red-500/20 opacity-60" :
                rec.urgency === "high" || rec.urgency === "immediate" ? "border-amber-500/20" : ""
              }>
                <CardContent className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <UrgencyBadge urgency={rec.urgency} />
                        <StatusBadge status={status} />
                        <Badge variant="outline" className="text-xs capitalize">{rec.category.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.summary}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {netImpact > 0 && (
                        <div className="flex items-center gap-1 text-emerald-400 justify-end">
                          <DollarSign className="h-3.5 w-3.5" />
                          <span className="text-sm font-bold">${(netImpact / 1_000_000).toFixed(1)}M</span>
                        </div>
                      )}
                      {impact?.confidenceLevel && <div className="text-xs text-muted-foreground capitalize mt-0.5">{impact.confidenceLevel} confidence</div>}
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-3"
                    onClick={() => setExpanded(isOpen ? null : rec.id)}
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {isOpen ? "Collapse" : "View full details"}
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-4">
                      <Separator />
                      <div>
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Business Rationale</div>
                        <p className="text-sm text-foreground/90">{rec.businessRationale}</p>
                      </div>
                      {rec.nextActions.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Next Actions</div>
                          <ol className="space-y-1">
                            {rec.nextActions.map((action, i) => (
                              <li key={i} className="text-sm flex gap-2">
                                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Owner: <strong className="text-foreground">{rec.recommendedOwner}</strong></span>
                        {impact?.paybackPeriodMonths && <span>· Payback: <strong className="text-foreground">{impact.paybackPeriodMonths}mo</strong></span>}
                        <span>· Affected: {rec.affectedMetricSlugs.slice(0, 3).join(", ")}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {isPending && rec.requiresApproval && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: rec.id, action: "approve" })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: rec.id, action: "defer" })}
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" /> Defer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        disabled={reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate({ id: rec.id, action: "reject" })}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
