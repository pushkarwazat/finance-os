import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Clock } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchBudgetModels() {
  const res = await fetch(`${BASE}api/budget/models`)
  if (!res.ok) throw new Error("Failed to fetch budget models")
  return res.json()
}

async function fetchBudgetVariance() {
  const res = await fetch(`${BASE}api/budget/variance?fiscalPeriod=2026-Q1`)
  if (!res.ok) throw new Error("Failed to fetch variance")
  return res.json()
}

function VarianceBadge({ isFavourable, isMaterial }: { isFavourable: boolean; isMaterial: boolean }) {
  if (!isMaterial) return <Badge variant="outline" className="text-xs">Sub-threshold</Badge>
  return isFavourable
    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Favourable</Badge>
    : <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">Unfavourable</Badge>
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  )
  if (status === "approved") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </Badge>
  )
  return <Badge variant="outline" className="text-xs">Not Required</Badge>
}

export function BudgetPage() {
  const models = useQuery({ queryKey: ["budget-models"], queryFn: fetchBudgetModels })
  const variance = useQuery({ queryKey: ["budget-variance"], queryFn: fetchBudgetVariance })

  const summary = variance.data?.summary
  const lines = variance.data?.data ?? []
  const activeModel = models.data?.data?.find((m: { isActive: boolean }) => m.isActive)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          FP&amp;A variance tracking · Reforecast workflows · Approval routing
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          All AI-drafted variance commentary requires human review before distribution.
          Materiality thresholds are defaults — confirm with CFO before go-live.
        </AlertDescription>
      </Alert>

      {/* Active budget model */}
      {activeModel && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Budget</CardTitle>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Active</Badge>
            </div>
            <CardDescription>{activeModel.versionLabel} · FY{activeModel.fiscalYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium capitalize">{activeModel.modelType.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Budgeted Revenue</p>
                <p className="text-sm font-medium">${(activeModel.totalBudgetedRevenue / 1e6).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Budgeted OpEx</p>
                <p className="text-sm font-medium">${(activeModel.totalBudgetedOpex / 1e6).toFixed(1)}M</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Approved By</p>
                <p className="text-sm font-medium truncate">{activeModel.approvedBy ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variance summary */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Total Lines</p>
              <p className="text-2xl font-semibold">{summary.totalLines}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Material</p>
              <p className="text-2xl font-semibold text-amber-400">{summary.materialCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-semibold text-red-400">{summary.pendingApprovalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Net Variance</p>
              <p className={`text-2xl font-semibold ${(summary.totalFavourableUsd + summary.totalUnfavourableUsd) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${((summary.totalFavourableUsd + summary.totalUnfavourableUsd) / 1e6).toFixed(1)}M
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Variance lines table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Q1 FY2026 — Budget Variance Lines</CardTitle>
          <CardDescription>
            Actuals vs {activeModel?.versionLabel ?? "approved budget"} · Material threshold: $50K or 5%
          </CardDescription>
        </CardHeader>
        <CardContent>
          {variance.isLoading && <p className="text-sm text-muted-foreground">Loading variance data…</p>}
          {variance.isError && <p className="text-sm text-red-400">Failed to load variance data.</p>}
          {lines.length > 0 && (
            <div className="space-y-3">
              {lines.map((line: {
                id: string
                lineItemName: string
                department?: string
                budgetAmount: number
                actualAmount: number
                varianceUsd: number
                variancePct: number
                isFavourable: boolean
                isMaterial: boolean
                approvalStatus: string
                rootCauseDraft?: string
              }) => (
                <div key={line.id} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-medium">{line.lineItemName}</p>
                      {line.department && (
                        <p className="text-xs text-muted-foreground capitalize">{line.department.replace(/_/g, " ")}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <VarianceBadge isFavourable={line.isFavourable} isMaterial={line.isMaterial} />
                      <ApprovalBadge status={line.approvalStatus} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Budget</p>
                      <p className="font-medium">${(line.budgetAmount / 1e6).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual</p>
                      <p className="font-medium">${(line.actualAmount / 1e6).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Variance</p>
                      <p className={`font-medium flex items-center gap-1 ${line.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                        {line.isFavourable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        ${Math.abs(line.varianceUsd / 1e3).toFixed(0)}K ({(line.variancePct * 100).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                  {line.rootCauseDraft && (
                    <>
                      <Separator className="my-1" />
                      <p className="text-xs text-muted-foreground italic">
                        <span className="font-medium text-amber-400 not-italic">Draft: </span>
                        {line.rootCauseDraft}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All budget versions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {models.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="space-y-2">
            {(models.data?.data ?? []).map((m: {
              id: string
              versionLabel: string
              modelType: string
              fiscalYear: number
              isActive: boolean
              approvedBy?: string
            }) => (
              <div key={m.id} className="flex items-center justify-between text-sm rounded border border-border px-3 py-2">
                <div>
                  <span className="font-medium">{m.versionLabel}</span>
                  <span className="text-muted-foreground ml-2 capitalize text-xs">{m.modelType.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.isActive
                    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Active</Badge>
                    : <Badge variant="outline" className="text-xs">Inactive</Badge>}
                  {m.approvedBy && <span className="text-xs text-muted-foreground">{m.approvedBy}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
