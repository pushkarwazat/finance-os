import { useState } from "react"
import { useListApprovals, useListAuditEvents, useDecideApproval } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import { CheckCircle2, XCircle, Clock, ShieldAlert, FileText, User } from "lucide-react"
import { cn } from "@/lib/utils"

export function GovernancePage() {
  const [activeTab, setActiveTab] = useState("approvals")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: approvalsResponse, isLoading: isLoadingApprovals } = useListApprovals()
  const { data: auditResponse, isLoading: isLoadingAudit } = useListAuditEvents()
  const decideApproval = useDecideApproval()

  const approvals = approvalsResponse?.data || []
  const auditEvents = auditResponse?.data || []

  const handleDecision = (id: string, decision: 'approved' | 'rejected') => {
    decideApproval.mutate(
      { id, data: { decision } },
      {
        onSuccess: () => {
          toast({
            title: `Request ${decision}`,
            description: `The approval request has been ${decision}.`,
            variant: decision === 'rejected' ? 'destructive' : 'default'
          })
          queryClient.invalidateQueries({ queryKey: ["/api/governance/approvals"] })
          queryClient.invalidateQueries({ queryKey: ["/api/governance/audit"] })
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to process the decision.",
            variant: "destructive"
          })
        }
      }
    )
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default: return "bg-muted text-muted-foreground border-muted"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500/10 text-green-500 border-green-500/20"
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "pending": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      default: return "bg-muted text-muted-foreground border-muted"
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Governance & Audit</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage approvals and review system activity.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="approvals">Pending Approvals</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-4">
          {isLoadingApprovals ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          ) : approvals.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-12 text-center text-muted-foreground">No approval requests found.</CardContent></Card>
          ) : (
            approvals.map((approval) => (
              <Card key={approval.id}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("capitalize px-1.5 py-0 text-[10px]", getStatusColor(approval.status || ""))}>
                          {approval.status}
                        </Badge>
                        <Badge variant="outline" className={cn("capitalize px-1.5 py-0 text-[10px]", getPriorityColor(approval.priority || "medium"))}>
                          {approval.priority}
                        </Badge>
                        <span className="text-sm font-medium">{approval.resourceLabel}</span>
                      </div>
                      
                      {approval.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{approval.notes}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {approval.requesterName}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {approval.createdAt ? formatDistanceToNow(parseISO(approval.createdAt), { addSuffix: true }) : ''}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {approval.resourceType}</span>
                      </div>
                    </div>

                    {approval.status === 'pending' ? (
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDecision(approval.id, 'rejected')}
                          disabled={decideApproval.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-success text-success-foreground hover:bg-success/90"
                          onClick={() => handleDecision(approval.id, 'approved')}
                          disabled={decideApproval.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      </div>
                    ) : (
                      <div className="shrink-0 text-sm text-muted-foreground flex items-center gap-1">
                        Resolved {approval.resolvedAt ? formatDistanceToNow(parseISO(approval.resolvedAt), { addSuffix: true }) : ''}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              {isLoadingAudit ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No audit events found.</div>
              ) : (
                <div className="divide-y">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="p-4 hover:bg-muted/50 transition-colors flex gap-4 items-start">
                      <div className="shrink-0 mt-1">
                        {event.outcome === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        ) : event.outcome === 'failure' ? (
                          <XCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <ShieldAlert className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm">
                            <span className="font-medium text-foreground">{event.actorName}</span>
                            <span className="text-muted-foreground"> ({event.actorRole}) </span>
                            <span className="font-semibold text-foreground">{event.action}</span>
                            <span className="text-muted-foreground"> on </span>
                            <span className="font-medium text-foreground">{event.resourceLabel}</span>
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap ml-4">
                            {event.timestamp ? formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true }) : ''}
                          </span>
                        </div>
                        {event.details && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{JSON.stringify(event.details)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
