import { useState } from "react"
import { useListVarianceDrivers, useListForecasts } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCurrency, formatPercentage, cn } from "@/lib/utils"
import { motion } from "framer-motion"

function getCategoryColor(category: string) {
  switch (category) {
    case "volume": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "price": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
    case "structural": return "bg-purple-500/10 text-purple-500 border-purple-500/20"
    case "mix": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    case "revenue": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
    case "cost": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
    case "operational": return "bg-purple-500/10 text-purple-500 border-purple-500/20"
    case "market": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
    default: return "bg-muted text-muted-foreground"
  }
}

export function VariancePage() {
  const [activeTab, setActiveTab] = useState("drivers")
  
  const { data: driversResponse, isLoading: isLoadingDrivers } = useListVarianceDrivers()
  const { data: forecastsResponse, isLoading: isLoadingForecasts } = useListForecasts()

  const drivers = driversResponse?.data || []
  const forecasts = forecastsResponse?.data || []

  const totalImpact = drivers.reduce((sum, d) => sum + (d.impact || 0), 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Variance Analysis</h2>
        <p className="text-muted-foreground text-sm mt-1">Identify drivers and track forecast performance.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="drivers">Variance Drivers</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Impact</TableHead>
                  <TableHead className="text-right">Impact %</TableHead>
                  <TableHead>Explanation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingDrivers ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    </TableRow>
                  ))
                ) : drivers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No variance drivers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {drivers.map((driver, i) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{(driver as any).metricName ?? driver.metricId}</TableCell>
                        <TableCell>{driver.driver}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("capitalize", getCategoryColor(driver.category || ""))}>
                            {driver.category}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-medium", driver.impact && driver.impact > 0 ? "text-success" : "text-destructive")}>
                          {driver.impact && driver.impact > 0 ? "+" : ""}{formatCurrency(driver.impact || 0)}
                        </TableCell>
                        <TableCell className={cn("text-right", driver.impactPct && driver.impactPct > 0 ? "text-success" : "text-destructive")}>
                          {formatPercentage(driver.impactPct || 0)}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate cursor-help">{driver.explanation}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{driver.explanation}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell colSpan={3}>Total Impact</TableCell>
                      <TableCell className={cn("text-right", totalImpact > 0 ? "text-success" : "text-destructive")}>
                        {totalImpact > 0 ? "+" : ""}{formatCurrency(totalImpact)}
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="forecasts">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                  <TableHead className="text-right">Prior Year</TableHead>
                  <TableHead className="w-[150px]">Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingForecasts ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 ml-auto rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-2 w-full mt-2" /></TableCell>
                    </TableRow>
                  ))
                ) : forecasts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No forecasts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  forecasts.map((f, i) => {
                    const variance = (f.actual || 0) - (f.budget || 0)
                    const isFavorable = variance > 0
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">
                          {f.metricName || f.metricId}
                          <div className="text-xs text-muted-foreground mt-0.5">{f.period} {f.fiscalYear}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(f.budget || 0, f.currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(f.actual || 0, f.currency)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className={cn(isFavorable ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
                            {isFavorable ? "+" : ""}{formatCurrency(variance, f.currency)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(f.forecast || 0, f.currency)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(f.prior || 0, f.currency)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={(f.confidence || 0) * 100} className="h-2" />
                            <span className="text-xs text-muted-foreground w-8 text-right">{Math.round((f.confidence || 0) * 100)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
