import { useState } from "react"
import { useListCloseTasks, useGetCloseSummary, useUpdateCloseTask } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQueryClient } from "@tanstack/react-query"
import { format, isPast, parseISO } from "date-fns"
import { CheckCircle2, Clock, AlertCircle, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"

export function ClosePage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const queryClient = useQueryClient()
  
  const { data: summary, isLoading: isLoadingSummary } = useGetCloseSummary()
  const { data: tasksResponse, isLoading: isLoadingTasks } = useListCloseTasks()
  const updateTask = useUpdateCloseTask()

  const tasks = tasksResponse?.data || []
  
  const filteredTasks = tasks.filter(task => {
    if (statusFilter === "all") return true
    return task.status === statusFilter
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "low": return "bg-green-500/10 text-green-500 border-green-500/20"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "text-green-500"
      case "in_progress": return "text-blue-500"
      case "review": return "text-indigo-500"
      case "blocked": return "text-red-500"
      default: return "text-muted-foreground"
    }
  }

  const handleStatusChange = (id: string, newStatus: string) => {
    updateTask.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/close/tasks"] })
          queryClient.invalidateQueries({ queryKey: ["/api/close/summary"] })
        }
      }
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Period Close</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage and track month-end close tasks.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <CircleDashed className="h-4 w-4" /> Total Tasks
            </div>
            {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-semibold">{summary?.totalTasks || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" /> Completed
            </div>
            {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-semibold">{(summary as any)?.byStatus?.complete || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Clock className="h-4 w-4 text-orange-500" /> Overdue
            </div>
            {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-semibold">{summary?.overdueTasks || 0}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" /> Critical
            </div>
            {isLoadingSummary ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-semibold">{(summary as any)?.criticalOpen || 0}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">In Review</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {isLoadingTasks ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : filteredTasks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              No tasks found.
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map(task => {
            const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== "complete"
            
            return (
              <Card key={task.id} className={cn("transition-colors", task.status === "complete" && "opacity-60")}>
                <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0", getPriorityColor(task.priority || "low"))}>
                        {task.priority}
                      </Badge>
                      <h4 className="font-semibold text-sm truncate">{task.name}</h4>
                      {task.dependencies && task.dependencies.length > 0 && (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Blocked
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                      <span>Assigned to: {task.assigneeName || "Unassigned"}</span>
                      {task.dueDate && (
                        <span className={cn(isOverdue && "text-destructive font-medium flex items-center gap-1")}>
                          {isOverdue && <AlertCircle className="h-3 w-3" />}
                          Due: {format(parseISO(task.dueDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="shrink-0">
                    <Select 
                      value={task.status} 
                      onValueChange={(val) => handleStatusChange(task.id, val)}
                      disabled={updateTask.isPending}
                    >
                      <SelectTrigger className={cn("w-[140px] h-8 text-xs font-medium", getStatusColor(task.status || "open"))}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">In Review</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {summary && (
        <div className="pt-4 space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Overall Progress</span>
            <span>{Math.round(((summary as any).completionRate || 0) * 100)}%</span>
          </div>
          <Progress value={((summary as any).completionRate || 0) * 100} className="h-2" />
        </div>
      )}
    </div>
  )
}
