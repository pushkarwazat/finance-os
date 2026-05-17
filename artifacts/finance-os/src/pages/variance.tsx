import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TrendingDown, TrendingUp } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchVarianceAnalysis() {
  const res = await fetch(`${BASE}api/variance/analysis`)
  if (!res.ok) throw new Error("Failed to fetch variance analysis")
  return res.json()
}

interface VarianceLine {
  label: string
  slug: string
  actual: number
  budget: number
  variance: number
  variancePct: number
  isFavourable: boolean
}

interface PeriodRow {
  period: number
  label: string
  actual: number
  budget: number
  variance: number
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString()}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

function VsTable({ rows, isLoading }: { rows: VarianceLine[]; isLoading: boolean }) {
  if (isLoading) return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />)}
    </div>
  )
  if (rows.length === 0) return <p className="text-sm text-muted-foreground p-4">No data available.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="text-left p-3 font-medium">Line Item</th>
            <th className="text-right p-3 font-medium">Budget</th>
            <th className="text-right p-3 font-medium">Actual</th>
            <th className="text-right p-3 font-medium">Variance</th>
            <th className="text-right p-3 font-medium">Var %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row) => (
            <tr key={row.slug} className="hover:bg-muted/30 transition-colors">
              <td className="p-3 font-medium">{row.label}</td>
              <td className="p-3 text-right text-muted-foreground">{fmt(row.budget)}</td>
              <td className="p-3 text-right">{fmt(row.actual)}</td>
              <td className={`p-3 text-right font-medium ${row.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                <span className="inline-flex items-center gap-1 justify-end">
                  {row.isFavourable ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {fmt(row.variance)}
                </span>
              </td>
              <td className={`p-3 text-right font-medium ${row.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                {row.variancePct >= 0 ? "+" : ""}{(row.variancePct * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function VariancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["variance-analysis"],
    queryFn: fetchVarianceAnalysis,
  })

  const summary: VarianceLine[] = data?.summary ?? []
  const divisions: VarianceLine[] = data?.divisions ?? []
  const departments: VarianceLine[] = data?.departments ?? []
  const periods: PeriodRow[] = data?.periods ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Variance Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">FY2026 YTD · Budget vs Actuals · Live GL Data</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted/30 rounded animate-pulse" /></CardContent></Card>
            ))
          : summary.map((line) => (
              <Card key={line.slug} className={Math.abs(line.variancePct) >= 0.05 && !line.isFavourable ? "border-amber-500/30" : ""}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{line.label}</p>
                  <p className="text-xl font-semibold mt-1">{fmt(line.variance)}</p>
                  <p className={`text-xs font-medium mt-0.5 ${line.isFavourable ? "text-emerald-400" : "text-red-400"}`}>
                    {line.variancePct >= 0 ? "+" : ""}{(line.variancePct * 100).toFixed(1)}% vs budget
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue="divisions">
        <TabsList>
          <TabsTrigger value="divisions">By Division</TabsTrigger>
          <TabsTrigger value="departments">By Department</TabsTrigger>
          <TabsTrigger value="periods">By Period</TabsTrigger>
        </TabsList>

        <TabsContent value="divisions" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Variance by Division</CardTitle>
              <CardDescription>FY2026 YTD · Sorted by absolute variance · Excl. eliminations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <VsTable rows={divisions} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Variances by Department</CardTitle>
              <CardDescription>FY2026 YTD · Net income lines · Departments with &gt;$500K absolute variance</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <VsTable rows={departments} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periods" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Monthly Revenue Variance</CardTitle>
              <CardDescription>FY2026 · Fiscal Period 1 (Jul 25) through Period 12 (Jun 26)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />)}
                </div>
              ) : periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No period data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Period</th>
                        <th className="text-right pb-2 font-medium">Budget</th>
                        <th className="text-right pb-2 font-medium">Actual</th>
                        <th className="text-right pb-2 font-medium">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {periods.map((p) => (
                        <tr key={p.period} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 font-medium">{p.label}</td>
                          <td className="py-2.5 text-right text-muted-foreground">{fmt(p.budget)}</td>
                          <td className="py-2.5 text-right">{fmt(p.actual)}</td>
                          <td className={`py-2.5 text-right font-medium ${p.variance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              {p.variance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {fmt(p.variance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
