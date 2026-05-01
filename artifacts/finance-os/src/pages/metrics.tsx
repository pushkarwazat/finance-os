import { useListMetrics, useGetMetricSummary } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercentage, formatNumber, cn } from "@/lib/utils"
import { ArrowDownIcon, ArrowUpIcon, Activity } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { motion } from "framer-motion"

export function MetricsPage() {
  const { data: summary, isLoading: isLoadingSummary } = useGetMetricSummary()
  const { data: metrics, isLoading: isLoadingMetrics } = useListMetrics({ limit: 8 })

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Financial Metrics</h2>
          <p className="text-muted-foreground text-sm mt-1">Key performance indicators for the current period.</p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingMetrics ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))
        ) : metrics?.data.map((metric, i) => {
          const isFavorable = metric.variance && metric.variance > 0
          const isUnfavorable = metric.variance && metric.variance < 0
          
          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-muted-foreground truncate pr-2">{metric.name}</p>
                    {metric.variancePct !== undefined && (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        isFavorable ? "bg-success/10 text-success" : 
                        isUnfavorable ? "bg-destructive/10 text-destructive" : 
                        "bg-muted text-muted-foreground"
                      )}>
                        {isFavorable ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : isUnfavorable ? <ArrowDownIcon className="h-3 w-3 mr-1" /> : null}
                        {formatPercentage(metric.variancePct / 100)}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <p className="text-2xl font-semibold">
                      {metric.unit === "currency" ? formatCurrency(metric.value, metric.currency) :
                       metric.unit === "percentage" ? formatPercentage(metric.value / 100, false) :
                       formatNumber(metric.value)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      vs {metric.unit === "currency" ? formatCurrency(metric.previousValue || 0, metric.currency) : formatNumber(metric.previousValue || 0)} budget
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
