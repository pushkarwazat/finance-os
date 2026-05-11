import { useListMetrics, useGetMetricSummary } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatPercentage, formatNumber, cn } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, Activity } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Period helpers
// ─────────────────────────────────────────────────────────────────────────────

function currentPeriodLabel(period: string, fiscalYear: number): string {
  return `${period} FY${fiscalYear}`
}

function priorPeriodLabel(period: string, fiscalYear: number): string {
  if (period === "Q1") return `Q4 FY${fiscalYear - 1}`
  if (period === "Q2") return `Q1 FY${fiscalYear}`
  if (period === "Q3") return `Q2 FY${fiscalYear}`
  if (period === "Q4") return `Q3 FY${fiscalYear}`
  return "prior period"
}

function formatMetricValue(
  value: number | undefined,
  unit: string,
  currency: string | undefined,
): string {
  if (value === undefined || value === null) return "—"
  if (unit === "currency") return formatCurrency(value, currency)
  if (unit === "percentage") return formatPercentage(value, false)
  return formatNumber(value)
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function MetricsPage() {
  const { data: summary, isLoading: isLoadingSummary } = useGetMetricSummary()
  const { data: metricsResp, isLoading: isLoadingMetrics } = useListMetrics({ limit: 8 })

  const metrics = metricsResp?.data ?? []

  // Derive the reporting period from the first metric
  const firstMetric = metrics[0]
  const reportingPeriod = firstMetric
    ? currentPeriodLabel(firstMetric.period, firstMetric.fiscalYear)
    : null

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Financial Metrics</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Key performance indicators
            {reportingPeriod && (
              <> · <span className="font-medium text-foreground">{reportingPeriod}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoadingSummary ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : summary ? (
          <>
            <Card className="bg-card">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Metrics tracked</p>
                  <p className="text-3xl font-semibold">{summary.totalMetrics}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Activity className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Favorable Variances</p>
                  <p className="text-3xl font-semibold text-success">{summary.favorableVariances}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center text-success">
                  <ArrowUpIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Unfavorable Variances</p>
                  <p className="text-3xl font-semibold text-destructive">{summary.unfavorableVariances}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                  <ArrowDownIcon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingMetrics ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))
        ) : metrics.map((metric, i) => {
          const isFavorable = metric.variance != null && metric.variance > 0
          const isUnfavorable = metric.variance != null && metric.variance < 0
          const periodLabel = currentPeriodLabel(metric.period, metric.fiscalYear)
          const priorLabel = priorPeriodLabel(metric.period, metric.fiscalYear)
          const currentFormatted = formatMetricValue(metric.value, metric.unit, metric.currency)
          const priorFormatted = formatMetricValue(metric.previousValue, metric.unit, metric.currency)

          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Header row: name + variance badge */}
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium text-muted-foreground leading-tight">{metric.name}</p>
                    {metric.variancePct !== undefined && (
                      <span className={cn(
                        "inline-flex items-center shrink-0 px-2 py-0.5 rounded text-xs font-medium",
                        isFavorable
                          ? "bg-success/10 text-success"
                          : isUnfavorable
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isFavorable
                          ? <ArrowUpIcon className="h-3 w-3 mr-1" />
                          : isUnfavorable
                          ? <ArrowDownIcon className="h-3 w-3 mr-1" />
                          : null}
                        {formatPercentage(metric.variancePct)}
                      </span>
                    )}
                  </div>

                  {/* Current period value */}
                  <div className="mt-3 flex-1">
                    <p className="text-2xl font-semibold tracking-tight">{currentFormatted}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{periodLabel}</p>
                  </div>

                  {/* Prior period comparison */}
                  {metric.previousValue !== undefined && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">Prior period</p>
                      <p className="text-sm font-medium text-foreground/80 mt-0.5">
                        {priorFormatted}
                        <span className="text-xs text-muted-foreground font-normal ml-1">({priorLabel})</span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
