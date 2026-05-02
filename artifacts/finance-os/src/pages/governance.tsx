import { useState } from "react"
import { useListApprovals, useListAuditEvents, useDecideApproval } from "@workspace/api-client-react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow, parseISO } from "date-fns"
import {
  CheckCircle2, XCircle, Clock, ShieldAlert, FileText, User,
  Shield, Lock, Database, Cpu, GitBranch, BarChart3, AlertTriangle,
  Eye, Ban, ArrowUpRight, BookOpen, Layers, ScrollText, Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const API = "/api"

type SimulateResult = {
  input: { role: string; permission: string; dataDomains: string[] }
  result: {
    allowed: boolean
    outcome: "allowed" | "blocked" | "escalated" | "abstained"
    reason: string | null
    appliedPolicies: string[]
    requiredRole: string | null
    sensitiveColumns: string[]
    abstentionTriggers: string[]
  }
  details: {
    rbacPolicy: { permissions: string[]; description: string } | null
    rowAccessPolicies: { name: string; scope: string; filterField: string }[]
    abstentionPolicies: { name: string; trigger: string; responseTemplate: string }[]
    evidenceRequirements: { name: string; minimumEvidenceCount: number; requiredEvidenceTypes: string[] }[]
    columnAccessSummary: { column: string; sensitivityLevel: string; canAccess: boolean; maskingStrategy: string }[]
  }
}

type DashboardStats = {
  activePolicies: number; pendingApprovals: number; auditLast24h: number
  flaggedPrompts: number; blockedPrompts: number; modelsRegistered: number
  modelsApproved: number; openReleases: number; answerRate: number; totalPrompts: number
  auditByOutcome: { success: number; failure: number; denied: number }
  promptByOutcome: { answered: number; blocked: number; escalated: number; abstained: number }
  rolesCount: number; abstentionPoliciesActive: number; evidenceRequirementsActive: number
  columnTagsTotal: number; rowAccessPoliciesActive: number
}

const ROLES = ["viewer", "analyst", "finance_manager", "operator", "controller", "cfo", "auditor", "admin"]
const PERMISSIONS = [
  "metrics:read", "metrics:write", "metrics:approve",
  "documents:read", "documents:write", "documents:delete",
  "workflows:read", "workflows:write", "workflows:approve",
  "close:read", "close:write", "close:approve",
  "governance:read", "governance:write", "governance:simulate",
  "evals:read", "evals:write", "ask:read", "ask:write", "admin:full",
]
const DATA_DOMAINS = ["metrics", "documents", "forecasts", "workflows", "users", "compensation", "strategic_plans", "policies"]

function outcomeColor(outcome: string) {
  switch (outcome) {
    case "allowed": case "answered": case "success": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    case "blocked": case "denied": case "failure": return "bg-red-500/10 text-red-400 border-red-500/20"
    case "escalated": return "bg-amber-500/10 text-amber-400 border-amber-500/20"
    case "abstained": return "bg-blue-500/10 text-blue-400 border-blue-500/20"
    case "pending_review": return "bg-purple-500/10 text-purple-400 border-purple-500/20"
    default: return "bg-muted text-muted-foreground border-muted"
  }
}

function sensitivityColor(level: string) {
  switch (level) {
    case "top_secret": return "bg-red-500/10 text-red-400 border-red-500/20"
    case "restricted": return "bg-orange-500/10 text-orange-400 border-orange-500/20"
    case "confidential": return "bg-amber-500/10 text-amber-400 border-amber-500/20"
    case "internal": return "bg-blue-500/10 text-blue-400 border-blue-500/20"
    default: return "bg-muted text-muted-foreground border-muted"
  }
}

function StatCard({ icon: Icon, label, value, sub, color = "text-foreground" }: {
  icon: React.ElementType; label: string; value: number | string; sub?: string; color?: string
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground mt-1" />
        </div>
      </CardContent>
    </Card>
  )
}

export function GovernancePage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Simulator state
  const [simRole, setSimRole] = useState("analyst")
  const [simPermission, setSimPermission] = useState("metrics:write")
  const [simDomains, setSimDomains] = useState<string[]>(["metrics"])
  const [simResult, setSimResult] = useState<SimulateResult | null>(null)
  const [simLoading, setSimLoading] = useState(false)

  // Prompt log filter
  const [promptFilter, setPromptFilter] = useState("all")

  const { data: approvalsResponse, isLoading: isLoadingApprovals } = useListApprovals()
  const { data: auditResponse, isLoading: isLoadingAudit } = useListAuditEvents()
  const decideApproval = useDecideApproval()

  const { data: dashData, isLoading: isLoadingDash } = useQuery<DashboardStats>({
    queryKey: ["/api/governance/dashboard"],
    queryFn: () => fetch(`${API}/governance/dashboard`).then((r) => r.json()),
  })

  const { data: promptLogsData, isLoading: isLoadingPrompts } = useQuery<{ data: {
    id: string; userName: string; userRole: string; prompt: string; response?: string
    outcome: string; dataDomainsTouched: string[]; riskScore?: number
    flaggedForReview: boolean; timestamp: string; blockedReason?: string; abstentionReason?: string
    latencyMs?: number
  }[]; total: number }>({
    queryKey: ["/api/governance/prompt-logs", promptFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (promptFilter !== "all") params.set("outcome", promptFilter)
      return fetch(`${API}/governance/prompt-logs?${params}`).then((r) => r.json())
    },
  })

  const { data: rbacData, isLoading: isLoadingRbac } = useQuery<{ data: {
    role: string; description: string; permissionCount: number; permissions: string[]; inheritsFrom: string[]
  }[] }>({
    queryKey: ["/api/governance/rbac/roles"],
    queryFn: () => fetch(`${API}/governance/rbac/roles`).then((r) => r.json()),
  })

  const { data: modelsData, isLoading: isLoadingModels } = useQuery<{ data: {
    id: string; modelId: string; displayName: string; provider: string; capabilities: string[]
    approvedForProduction: boolean; biasAssessment: string; complianceFrameworks: string[]
    deployedEnvironments: string[]; averageLatencyMs?: number; notes?: string; approvedBy?: string
  }[] }>({
    queryKey: ["/api/governance/model-registry"],
    queryFn: () => fetch(`${API}/governance/model-registry`).then((r) => r.json()),
  })

  const { data: releasesData, isLoading: isLoadingReleases } = useQuery<{ data: {
    id: string; version: string; displayName: string; status: string; releaseType: string
    riskLevel: string; deployedAt?: string; scheduledAt?: string; changeLog: { type: string; description: string }[]
    approvals: { approverName: string; approverRole: string }[]
  }[] }>({
    queryKey: ["/api/governance/releases"],
    queryFn: () => fetch(`${API}/governance/releases`).then((r) => r.json()),
  })

  const { data: colSensData } = useQuery<{ data: {
    id: string; dataSource: string; columnName: string; displayLabel: string
    sensitivityLevel: string; piiCategory: string; requiredRoles: string[]
    maskingStrategy: string; aiPromptExposureAllowed: boolean
  }[] }>({
    queryKey: ["/api/governance/column-sensitivity"],
    queryFn: () => fetch(`${API}/governance/column-sensitivity`).then((r) => r.json()),
  })

  const approvals = approvalsResponse?.data || []
  const auditEvents = auditResponse?.data || []

  const handleDecision = (id: string, decision: "approved" | "rejected") => {
    decideApproval.mutate(
      { id, data: { decision } },
      {
        onSuccess: () => {
          toast({ title: `Request ${decision}`, description: `Approval has been ${decision}.` })
          queryClient.invalidateQueries({ queryKey: ["/api/governance/approvals"] })
          queryClient.invalidateQueries({ queryKey: ["/api/governance/audit"] })
          queryClient.invalidateQueries({ queryKey: ["/api/governance/dashboard"] })
        },
        onError: () => toast({ title: "Error", description: "Failed to process decision.", variant: "destructive" }),
      }
    )
  }

  const runSimulation = async () => {
    setSimLoading(true)
    try {
      const r = await fetch(`${API}/governance/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: simRole, permission: simPermission, dataDomains: simDomains }),
      })
      setSimResult(await r.json())
    } finally {
      setSimLoading(false)
    }
  }

  const toggleDomain = (d: string) =>
    setSimDomains((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": case "urgent": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case "medium": case "normal": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      default: return "bg-muted text-muted-foreground border-muted"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "approved": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      case "rejected": return "bg-red-500/10 text-red-500 border-red-500/20"
      case "escalated": return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      default: return "bg-muted text-muted-foreground border-muted"
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Governance & Controls</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise-grade policy enforcement, access controls, and AI output governance.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="releases">Releases</TabsTrigger>
        </TabsList>

        {/* ── Dashboard ── */}
        <TabsContent value="dashboard" className="space-y-6">
          {isLoadingDash ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : dashData ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Shield} label="Active Policies" value={dashData.activePolicies} sub="Approval, access, retention" />
                <StatCard icon={Clock} label="Pending Approvals" value={dashData.pendingApprovals}
                  color={dashData.pendingApprovals > 0 ? "text-amber-400" : "text-foreground"} />
                <StatCard icon={ScrollText} label="Audit Events (24h)" value={dashData.auditLast24h} />
                <StatCard icon={BarChart3} label="AI Answer Rate" value={`${dashData.answerRate}%`}
                  sub={`${dashData.totalPrompts} total prompts`} />
                <StatCard icon={Ban} label="Blocked Prompts" value={dashData.blockedPrompts}
                  color={dashData.blockedPrompts > 0 ? "text-red-400" : "text-foreground"} />
                <StatCard icon={AlertTriangle} label="Flagged for Review" value={dashData.flaggedPrompts}
                  color={dashData.flaggedPrompts > 0 ? "text-amber-400" : "text-foreground"} />
                <StatCard icon={Cpu} label="Models Registered" value={dashData.modelsRegistered}
                  sub={`${dashData.modelsApproved} production-approved`} />
                <StatCard icon={GitBranch} label="Pending Releases" value={dashData.openReleases} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Audit Outcomes</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(dashData.auditByOutcome).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-muted-foreground">{k}</span>
                        <Badge variant="outline" className={outcomeColor(k)}>{v}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Prompt Outcomes</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(dashData.promptByOutcome).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-muted-foreground">{k}</span>
                        <Badge variant="outline" className={outcomeColor(k)}>{v}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Policy Layer Health</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {[
                      { label: "RBAC Roles", value: dashData.rolesCount },
                      { label: "Abstention Policies", value: dashData.abstentionPoliciesActive },
                      { label: "Evidence Requirements", value: dashData.evidenceRequirementsActive },
                      { label: "Column Tags", value: dashData.columnTagsTotal },
                      { label: "Row Access Policies", value: dashData.rowAccessPoliciesActive },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Column Sensitivity Summary */}
              {colSensData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Column Sensitivity Tags
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
                      {colSensData.data.map((tag) => (
                        <div key={tag.id} className="py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{tag.displayLabel}</p>
                            <p className="text-xs text-muted-foreground">{tag.dataSource}.{tag.columnName}</p>
                          </div>
                          <Badge variant="outline" className={sensitivityColor(tag.sensitivityLevel)}>
                            {tag.sensitivityLevel.replace("_", " ").toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{tag.piiCategory}</Badge>
                          <Badge variant="outline" className={cn("text-xs", tag.aiPromptExposureAllowed ? "text-emerald-400 border-emerald-500/20" : "text-red-400 border-red-500/20")}>
                            {tag.aiPromptExposureAllowed ? "AI: allowed" : "AI: blocked"}
                          </Badge>
                          <span className="text-xs text-muted-foreground w-32 text-right shrink-0">
                            {tag.requiredRoles.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </TabsContent>

        {/* ── Audit Trail ── */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Prompt & Action Audit Trail</h2>
            <div className="flex gap-2">
              {(["all", "answered", "blocked", "escalated", "abstained"] as const).map((f) => (
                <Button key={f} size="sm" variant={promptFilter === f ? "default" : "outline"}
                  onClick={() => setPromptFilter(f)} className="capitalize text-xs">
                  {f}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingPrompts ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(promptLogsData?.data ?? []).map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-0.5">
                          {log.outcome === "answered" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            : log.outcome === "blocked" ? <Ban className="h-4 w-4 text-red-400" />
                            : log.outcome === "escalated" ? <ArrowUpRight className="h-4 w-4 text-amber-400" />
                            : <Eye className="h-4 w-4 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{log.userName}</span>
                            <Badge variant="outline" className="text-xs">{log.userRole}</Badge>
                            <Badge variant="outline" className={cn("text-xs", outcomeColor(log.outcome))}>
                              {log.outcome}
                            </Badge>
                            {log.flaggedForReview && (
                              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                                Flagged
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1 italic">"{log.prompt}"</p>
                          {(log.blockedReason || log.abstentionReason) && (
                            <p className="text-xs text-red-400/80">{log.blockedReason ?? log.abstentionReason}</p>
                          )}
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            {log.dataDomainsTouched.map((d) => (
                              <span key={d} className="flex items-center gap-1"><Database className="h-3 w-3" />{d}</span>
                            ))}
                            {log.latencyMs && <span>{log.latencyMs}ms</span>}
                            {log.riskScore !== undefined && (
                              <span className={cn(log.riskScore > 0.6 ? "text-red-400" : log.riskScore > 0.3 ? "text-amber-400" : "text-emerald-400")}>
                                risk {Math.round(log.riskScore * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-4">System Audit Events</h2>
            <Card>
              <CardContent className="p-0">
                {isLoadingAudit ? (
                  <div className="p-6 space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="divide-y">
                    {auditEvents.map((event) => (
                      <div key={event.id} className="p-4 hover:bg-muted/50 transition-colors flex gap-4 items-start">
                        <div className="shrink-0 mt-1">
                          {event.outcome === "success" ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            : event.outcome === "failure" ? <XCircle className="h-5 w-5 text-destructive" />
                            : <ShieldAlert className="h-5 w-5 text-amber-500" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <p className="text-sm">
                              <span className="font-medium">{event.actorName}</span>
                              <span className="text-muted-foreground"> ({event.actorRole}) </span>
                              <span className="font-semibold">{event.action}</span>
                              <span className="text-muted-foreground"> on </span>
                              <span className="font-medium">{event.resourceLabel}</span>
                            </p>
                            <span className="text-xs text-muted-foreground shrink-0 ml-4">
                              {event.timestamp ? formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true }) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{JSON.stringify(event.details)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Policy Simulator ── */}
        <TabsContent value="simulator" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Policy Simulator</h2>
            <p className="text-sm text-muted-foreground">Test any role + permission + data domain combination against all active policies.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Simulation Input</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Role</label>
                  <Select value={simRole} onValueChange={setSimRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Permission</label>
                  <Select value={simPermission} onValueChange={setSimPermission}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERMISSIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Data Domains (click to toggle)</label>
                  <div className="flex flex-wrap gap-2">
                    {DATA_DOMAINS.map((d) => (
                      <button key={d} onClick={() => toggleDomain(d)}
                        className={cn("px-2 py-1 rounded text-xs border transition-colors",
                          simDomains.includes(d)
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "text-muted-foreground border-border hover:border-primary/30")}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <Button onClick={runSimulation} disabled={simLoading} className="w-full">
                  {simLoading ? "Simulating…" : "Run Policy Check"}
                </Button>
              </CardContent>
            </Card>

            {simResult ? (
              <Card className={cn("border-2", simResult.result.outcome === "allowed"
                ? "border-emerald-500/30" : simResult.result.outcome === "escalated"
                ? "border-amber-500/30" : "border-red-500/30")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Result</CardTitle>
                    <Badge className={cn("capitalize", outcomeColor(simResult.result.outcome))}>
                      {simResult.result.outcome}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {simResult.result.reason && (
                    <p className="text-muted-foreground text-xs bg-muted/50 p-3 rounded-md">{simResult.result.reason}</p>
                  )}
                  {simResult.result.sensitiveColumns.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Sensitive columns touched:</p>
                      <div className="flex flex-wrap gap-1">
                        {simResult.result.sensitiveColumns.map((c) => (
                          <Badge key={c} variant="outline" className="text-xs text-amber-400 border-amber-500/20">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {simResult.details.rbacPolicy && (
                    <div>
                      <p className="text-xs font-medium mb-1">RBAC: {simResult.details.rbacPolicy.permissions.length} permissions granted</p>
                      <p className="text-xs text-muted-foreground">{simResult.details.rbacPolicy.description}</p>
                    </div>
                  )}
                  {simResult.details.rowAccessPolicies.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Row Access ({simResult.details.rowAccessPolicies.length}):</p>
                      {simResult.details.rowAccessPolicies.slice(0, 2).map((p) => (
                        <p key={p.name} className="text-xs text-muted-foreground">• {p.name} — scope: {p.scope}</p>
                      ))}
                    </div>
                  )}
                  {simResult.details.abstentionPolicies.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Abstention policies active ({simResult.details.abstentionPolicies.length}):</p>
                      {simResult.details.abstentionPolicies.slice(0, 2).map((p) => (
                        <p key={p.name} className="text-xs text-muted-foreground">• {p.name} ({p.trigger})</p>
                      ))}
                    </div>
                  )}
                  {simResult.details.columnAccessSummary.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Column access:</p>
                      <div className="space-y-1">
                        {simResult.details.columnAccessSummary.map((c) => (
                          <div key={c.column} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{c.column}</span>
                            <span className={c.canAccess ? "text-emerald-400" : "text-red-400"}>
                              {c.canAccess ? "✓" : "✗"} {c.sensitivityLevel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="flex items-center justify-center bg-muted/20">
                <div className="text-center p-8 space-y-2">
                  <Settings className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Configure inputs and run a policy check to see results here.</p>
                </div>
              </Card>
            )}
          </div>

          {/* RBAC matrix */}
          {isLoadingRbac ? <Skeleton className="h-48 w-full" /> : rbacData && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Layers className="h-4 w-4" />RBAC Roles</CardTitle></CardHeader>
              <CardContent>
                <div className="divide-y">
                  {rbacData.data.map((r) => (
                    <div key={r.role} className="py-3 flex items-start gap-4">
                      <div className="w-32 shrink-0">
                        <Badge variant="outline" className="text-xs font-mono">{r.role}</Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-2">{r.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {r.permissions.map((p) => (
                            <span key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{p}</span>
                          ))}
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.permissionCount} perms</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Approvals ── */}
        <TabsContent value="approvals" className="space-y-4">
          <h2 className="text-lg font-semibold">Approval Queue</h2>
          {isLoadingApprovals ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : approvals.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">No approval requests found.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {approvals.map((approval) => (
                <Card key={approval.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={getStatusColor(approval.status)}>{approval.status}</Badge>
                          <Badge variant="outline" className={getPriorityColor(approval.priority)}>{approval.priority}</Badge>
                          <span className="text-sm font-medium">{approval.resourceLabel}</span>
                        </div>
                        {approval.notes && <p className="text-sm text-muted-foreground line-clamp-2">{approval.notes}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{approval.requesterName}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                            {approval.createdAt ? formatDistanceToNow(parseISO(approval.createdAt), { addSuffix: true }) : ""}
                          </span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{approval.resourceType}</span>
                        </div>
                      </div>
                      {approval.status === "pending" ? (
                        <div className="flex gap-2 shrink-0">
                          <Button variant="outline" size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDecision(approval.id, "rejected")}
                            disabled={decideApproval.isPending}>
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleDecision(approval.id, "approved")}
                            disabled={decideApproval.isPending}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          Resolved {approval.resolvedAt ? formatDistanceToNow(parseISO(approval.resolvedAt), { addSuffix: true }) : ""}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Model Registry ── */}
        <TabsContent value="models" className="space-y-4">
          <h2 className="text-lg font-semibold">AI Model Registry</h2>
          {isLoadingModels ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(modelsData?.data ?? []).map((model) => (
                <Card key={model.id} className={cn("border", model.approvedForProduction ? "border-emerald-500/20" : "border-border")}>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{model.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{model.modelId}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={model.approvedForProduction
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                          : "bg-muted text-muted-foreground text-xs"}>
                          {model.approvedForProduction ? "Prod Approved" : "Not Approved"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{model.provider}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {model.capabilities.map((c) => (
                        <span key={c} className="text-xs bg-muted px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Bias: </span>
                        <span className={model.biasAssessment === "low" ? "text-emerald-400" : model.biasAssessment === "medium" ? "text-amber-400" : "text-red-400"}>
                          {model.biasAssessment}
                        </span>
                      </div>
                      {model.averageLatencyMs && <div><span className="text-muted-foreground">Latency: </span>{model.averageLatencyMs}ms avg</div>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {model.complianceFrameworks.map((f) => (
                        <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {model.deployedEnvironments.map((e) => (
                        <span key={e} className={cn("text-xs px-1.5 py-0.5 rounded border",
                          e === "production" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                            : e === "staging" ? "text-blue-400 border-blue-500/20 bg-blue-500/5"
                            : "text-muted-foreground border-border")}>{e}</span>
                      ))}
                    </div>
                    {model.approvedBy && (
                      <p className="text-xs text-muted-foreground">Approved by: {model.approvedBy}</p>
                    )}
                    {model.notes && <p className="text-xs text-muted-foreground line-clamp-2">{model.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Releases ── */}
        <TabsContent value="releases" className="space-y-4">
          <h2 className="text-lg font-semibold">Release History</h2>
          {isLoadingReleases ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {(releasesData?.data ?? []).map((rel) => (
                <Card key={rel.id}>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-muted-foreground">v{rel.version}</span>
                          <span className="font-medium text-sm">{rel.displayName}</span>
                          <Badge variant="outline" className={cn("text-xs capitalize",
                            rel.status === "deployed" ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                              : rel.status === "scheduled" ? "text-blue-400 border-blue-500/20 bg-blue-500/5"
                              : rel.status === "rolled_back" ? "text-red-400 border-red-500/20"
                              : "bg-muted text-muted-foreground")}>{rel.status}</Badge>
                          <Badge variant="outline" className={cn("text-xs",
                            rel.riskLevel === "critical" ? "text-red-400 border-red-500/20"
                              : rel.riskLevel === "high" ? "text-orange-400 border-orange-500/20"
                              : rel.riskLevel === "medium" ? "text-amber-400 border-amber-500/20"
                              : "text-muted-foreground")}>Risk: {rel.riskLevel}</Badge>
                        </div>
                        <div className="space-y-0.5">
                          {rel.changeLog.slice(0, 3).map((c, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                              <span className={cn("mr-1 font-medium",
                                c.type === "added" ? "text-emerald-400" : c.type === "fixed" ? "text-blue-400"
                                  : c.type === "security" ? "text-red-400" : c.type === "removed" ? "text-red-400" : "text-amber-400")}>
                                [{c.type}]
                              </span>{c.description}
                            </p>
                          ))}
                          {rel.changeLog.length > 3 && (
                            <p className="text-xs text-muted-foreground">+{rel.changeLog.length - 3} more changes</p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground space-y-1">
                        {rel.deployedAt && <p>{formatDistanceToNow(parseISO(rel.deployedAt), { addSuffix: true })}</p>}
                        {rel.scheduledAt && !rel.deployedAt && <p>Scheduled {formatDistanceToNow(parseISO(rel.scheduledAt), { addSuffix: true })}</p>}
                        {rel.approvals.length > 0 && (
                          <p className="text-emerald-400 flex items-center gap-1 justify-end">
                            <CheckCircle2 className="h-3 w-3" />
                            {rel.approvals.map((a) => a.approverName).join(", ")}
                          </p>
                        )}
                        {rel.approvals.length === 0 && (
                          <p className="text-amber-400 flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3" /> Awaiting approval
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
