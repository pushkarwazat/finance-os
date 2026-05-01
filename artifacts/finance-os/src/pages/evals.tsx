import { useState } from "react"
import { useListEvalSuites, useListEvalRuns, useCreateEvalRun } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { Play, ChevronDown, ChevronRight, Activity, CheckCircle2, XCircle } from "lucide-react"
import { cn, formatPercentage } from "@/lib/utils"
import { format, parseISO, differenceInSeconds } from "date-fns"

export function EvalsPage() {
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>("")
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: suitesResponse, isLoading: isLoadingSuites } = useListEvalSuites()
  const suites = suitesResponse?.data || []
  
  // Set default selected suite when loaded
  if (suites.length > 0 && !selectedSuiteId && !isLoadingSuites) {
    setSelectedSuiteId(suites[0].id)
  }

  const { data: runsResponse, isLoading: isLoadingRuns } = useListEvalRuns(
    selectedSuiteId ? { suiteId: selectedSuiteId } : undefined,
    { query: { enabled: !!selectedSuiteId } }
  )
  const runs = runsResponse?.data || []

  const createRun = useCreateEvalRun()

  const handleRunEval = () => {
    if (!selectedSuiteId) return
    
    // In a real app we'd have a selector for agents, using a dummy one here
    createRun.mutate(
      { data: { suiteId: selectedSuiteId, agentId: "agent-1" } },
      {
        onSuccess: () => {
          toast({ title: "Evaluation Started", description: "The evaluation run has been queued." })
          queryClient.invalidateQueries({ queryKey: ["/api/evals/runs"] })
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to start evaluation run.", variant: "destructive" })
        }
      }
    )
  }

  const selectedSuite = suites.find(s => s.id === selectedSuiteId)

  const getPassRateColor = (rate: number) => {
    if (rate >= 0.8) return "text-success font-semibold"
    if (rate >= 0.6) return "text-amber-500 font-semibold"
    return "text-destructive font-semibold"
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI Evaluations</h2>
          <p className="text-muted-foreground text-sm mt-1">Benchmark agent performance against test suites.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isLoadingSuites ? (
            <Skeleton className="h-10 w-[200px]" />
          ) : (
            <Select value={selectedSuiteId} onValueChange={setSelectedSuiteId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select Eval Suite" />
              </SelectTrigger>
              <SelectContent>
                {suites.map(suite => (
                  <SelectItem key={suite.id} value={suite.id}>{suite.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button 
            onClick={handleRunEval} 
            disabled={!selectedSuiteId || createRun.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" /> Run Suite
          </Button>
        </div>
      </div>

      {selectedSuite && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-lg">{selectedSuite.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedSuite.description}</p>
            </div>
            <div className="flex items-center gap-4 text-sm bg-background p-2 rounded-md border">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Version</span>
                <span className="font-medium">{selectedSuite.version}</span>
              </div>
              <div className="w-px h-8 bg-border"></div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Test Cases</span>
                <span className="font-medium">{(selectedSuite as any).caseCount ?? selectedSuite.cases?.length ?? 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pass Rate</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingRuns ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No evaluation runs found for this suite.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <Collapsible 
                    key={run.id} 
                    asChild
                    open={expandedRun === run.id}
                    onOpenChange={(open) => setExpandedRun(open ? run.id : null)}
                  >
                    <>
                      <TableRow className={cn("cursor-pointer", expandedRun === run.id && "bg-muted/50")}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 p-0">
                              {expandedRun === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{run.id.substring(0, 8)}...</TableCell>
                        <TableCell className="font-medium">{run.agentName || run.agentId}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "capitalize font-normal text-xs",
                            run.status === 'completed' ? "text-success border-success/30" :
                            run.status === 'failed' ? "text-destructive border-destructive/30" :
                            "text-blue-500 border-blue-500/30"
                          )}>
                            {run.status === 'running' ? <Activity className="h-3 w-3 mr-1 animate-pulse" /> : null}
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={getPassRateColor(run.passRate || 0)}>
                          {run.passRate !== undefined ? formatPercentage(run.passRate, false) : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {run.startedAt ? format(parseISO(run.startedAt), "MMM d, HH:mm:ss") : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {run.startedAt && run.completedAt 
                            ? `${differenceInSeconds(parseISO(run.completedAt), parseISO(run.startedAt))}s` 
                            : '-'}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={7} className="p-0 border-b">
                            {run.results && run.results.length > 0 ? (
                              <div className="p-4 pl-12 space-y-4">
                                <h4 className="text-sm font-medium mb-2">Test Case Results</h4>
                                <div className="grid gap-2">
                                  {run.results.map((result: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-md bg-background border text-sm">
                                      <div className="flex items-center gap-3">
                                        {result.passed ? 
                                          <CheckCircle2 className="h-4 w-4 text-success" /> : 
                                          <XCircle className="h-4 w-4 text-destructive" />
                                        }
                                        <span className="font-medium">{result.caseId}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        {result.score !== undefined && (
                                          <span className="text-xs text-muted-foreground">Score: {(result.score * 100).toFixed(0)}/100</span>
                                        )}
                                        <Badge variant="secondary" className={cn(result.passed ? "text-success" : "text-destructive")}>
                                          {result.passed ? "Pass" : "Fail"}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 pl-12 text-sm text-muted-foreground">No detailed results available.</div>
                            )}
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
