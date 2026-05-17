import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingDown, TrendingUp } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchBudgetModels() {
  const res = await fetch(`${BASE}api/budget/models`)
  if (!res.ok) throw new Error("Failed to fetch budget models")
  return res.json()
}

async function fetchVsActuals() {
  const res = await fetch(`${BASE}api/budget/vs-actuals`)
  if (!res.ok) throw new Error("Failed to fetch vs actuals")
  return res.json()
}

interface VsActualsLine {
  label: string
  slug: string
  actual: number
  budget: number
  variance: number
  variancePct: number
  isFavourable: boolean
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString()}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

function VsTable({ title, description, rows, isLoading }: {
  title: string; description?: string; rows: VsActualsLine[]; isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Line Item</th>
                  <th className="text-right pb-2 font-medium">Budget</th>
                  <th className="text-right pb-2 font-medium">Actual</th>
                  <th className="text-right pb-2 font-medium">Variance</th>
                  <th className="text-right pb-2 font-medium">Var %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {rows.map((row) => (
                  <tr key={row.slug} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 font-medium">{row.label}</td>
                    <td className="py-2.5 text-right text-muted-foreground">{fmt(row.budget)}</td>
                    <td className="py-2.5 text-right">{fmt(row.actual)}</td>
                    <td className={`py-2.5 text-right font-medium ${row.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                      <span className="inline-flex items-center gap-1 justify-end">
                        {row.isFavourable
                          ? <TrendingUp className="h-3 w-3" />
                          : <TrendingDown className="h-3 w-3" />}
                        {fmt(row.variance)}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-medium ${row.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                      {row.variancePct >= 0 ? "+" : ""}{(row.variancePct * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BudgetPage() {
  const models = useQuery({ queryKey: ["budget-models"], queryFn: fetchBudgetModels })
  const vsActuals = useQuery({ queryKey: ["budget-vs-actuals"], queryFn: fetchVsActuals })

  const activeModel = models.data?.data?.find((m: { isActive: boolean }) => m.isActive)
  const pl: VsActualsLine[] = vsActuals.data?.pl ?? []
  const divisions: VsActualsLine[] = vsActuals.data?.divisions ?? []

  const revenue = pl.find((r) => r.slug === "revenue")
  const materialCount = pl.filter((r) => Math.abs(r.variancePct) >= 0.05).length

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          FY2026 Budget vs Actuals · Live GL Data
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {vsActuals.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted/30 rounded animate-pulse" /></CardContent></Card>
            ))
          : (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Budgeted Revenue</p>
                  <p className="text-2xl font-semibold">{revenue ? fmt(revenue.budget) : "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Actual Revenue</p>
                  <p className="text-2xl font-semibold">{revenue ? fmt(revenue.actual) : "—"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Revenue Variance</p>
                  <p className={`text-2xl font-semibold ${revenue?.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                    {revenue
                      ? `${revenue.variancePct >= 0 ? "+" : ""}${(revenue.variancePct * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Material Variances</p>
                  <p className={`text-2xl font-semibold ${materialCount > 0 ? "text-amber-400" : ""}`}>
                    {materialCount}
                  </p>
                  <p className="text-xs text-muted-foreground">≥5% of budget</p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {/* P&L Summary */}
      <VsTable
        title="P&L Summary — FY2026 YTD"
        description="Budget vs Actuals across key P&L lines"
        rows={pl}
        isLoading={vsActuals.isLoading}
      />

      {/* Division breakdown */}
      <VsTable
        title="Revenue by Division — FY2026 YTD"
        description="Budget vs Actuals · Revenue only · Excl. eliminations"
        rows={divisions}
        isLoading={vsActuals.isLoading}
      />

      {/* Budget versions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Versions</CardTitle>
        </CardHeader>
        <CardContent>
          {models.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          <div className="space-y-2">
            {(models.data?.data ?? []).map((m: {
              id: string; versionLabel: string; modelType: string
              fiscalYear: number; isActive: boolean; approvedBy?: string
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
