import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle2, Clock, FileText, Users, Workflow, Shield } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchRequirements() {
  const res = await fetch(`${BASE}api/requirements`)
  if (!res.ok) throw new Error("Failed to fetch requirements")
  return res.json()
}
async function fetchGoals() {
  const res = await fetch(`${BASE}api/requirements/goals`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}
async function fetchWorkflows() {
  const res = await fetch(`${BASE}api/requirements/workflows`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}
async function fetchControls() {
  const res = await fetch(`${BASE}api/requirements/controls`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}
async function fetchAssumptions() {
  const res = await fetch(`${BASE}api/requirements/assumptions`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

function StatusBadge({ status }: { status: string }) {
  if (status === "existing") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">Existing</Badge>
  if (status?.startsWith("new")) return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">New</Badge>
  if (status === "extension") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Extension</Badge>
  return <Badge variant="outline" className="text-xs">{status}</Badge>
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "P0") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-mono">P0</Badge>
  if (priority === "P1") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs font-mono">P1</Badge>
  return <Badge variant="outline" className="text-xs font-mono">{priority}</Badge>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === "HIGH") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">High confidence</Badge>
  if (confidence === "MEDIUM") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Medium — confirm</Badge>
  return <Badge variant="outline" className="text-xs">Low</Badge>
}

export function RequirementsInspectorPage() {
  const summary = useQuery({ queryKey: ["req-summary"], queryFn: fetchRequirements })
  const goals = useQuery({ queryKey: ["req-goals"], queryFn: fetchGoals })
  const workflows = useQuery({ queryKey: ["req-workflows"], queryFn: fetchWorkflows })
  const controls = useQuery({ queryKey: ["req-controls"], queryFn: fetchControls })
  const assumptions = useQuery({ queryKey: ["req-assumptions"], queryFn: fetchAssumptions })

  const s = summary.data?.data
  const assume = assumptions.data

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Requirements Inspector</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Extracted requirements · Traceability · Assumptions · Open questions
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          Primary source document is inaccessible (Google Doc requires authentication). Requirements were
          extracted from the attached brief. See <code className="text-xs">requirements/open-questions.md</code> for OQ-001.
        </AlertDescription>
      </Alert>

      {/* Summary cards */}
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Business Goals", count: s.categorySummary.businessGoals, icon: <CheckCircle2 className="h-4 w-4" /> },
            { label: "Workflows", count: s.categorySummary.workflows, icon: <Workflow className="h-4 w-4" /> },
            { label: "User Roles", count: s.categorySummary.userRoles, icon: <Users className="h-4 w-4" /> },
            { label: "Gov. Controls", count: s.categorySummary.governanceControls, icon: <Shield className="h-4 w-4" /> },
          ].map(({ label, count, icon }) => (
            <Card key={label}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
                <p className="text-2xl font-semibold">{count}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="goals">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Goals</CardTitle>
              <CardDescription>Extracted from requirements brief — mapped to implementation modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(goals.data?.data ?? []).map((g: {
                id: string; goal: string; priority: string; status: string; existingModule?: string; newModule?: string
              }) => (
                <div key={g.id} className="rounded border border-border px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{g.id}</span>
                    <div className="flex gap-1">
                      <PriorityBadge priority={g.priority} />
                      <StatusBadge status={g.status} />
                    </div>
                  </div>
                  <p className="text-sm">{g.goal}</p>
                  {(g.existingModule || g.newModule) && (
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {g.existingModule ?? g.newModule}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow Inventory</CardTitle>
              <CardDescription>All finance workflow agents — existing and new this phase</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(workflows.data?.data ?? []).map((w: {
                id: string; name: string; description: string; status: string; module?: string
              }) => (
                <div key={w.id} className="rounded border border-border px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{w.name}</span>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{w.description}</p>
                  {w.module && <p className="text-xs font-mono text-muted-foreground/70 truncate">{w.module}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Governance Controls</CardTitle>
              <CardDescription>Mapped to packages/governance and enforcement modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(controls.data?.data ?? []).map((c: {
                id: string; control: string; framework: string; status: string; module?: string; newExtension?: string
              }) => (
                <div key={c.id} className="rounded border border-border px-3 py-2 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                      <Badge variant="outline" className="text-xs">{c.framework}</Badge>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs">{c.control}</p>
                  <p className="text-xs font-mono text-muted-foreground/70 truncate">
                    {c.module ?? c.newExtension}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assumptions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documented Assumptions</CardTitle>
              <CardDescription>
                {assume?.pendingConfirmCount} pending confirmation from CFO/Controller before go-live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {assume?.pendingConfirmCount !== undefined && (
                <Alert className="border-amber-500/30 bg-amber-500/5 mb-3">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-300 text-sm">
                    {assume.pendingConfirmCount} assumptions require confirmation.
                    See <code className="text-xs">requirements/assumptions.md</code> for details.
                  </AlertDescription>
                </Alert>
              )}
              {(assume?.keyAssumptions ?? []).map((a: {
                id: string; summary: string; confidence: string
              }) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded border border-border px-3 py-2 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
                    </div>
                    <p className="text-xs">{a.summary}</p>
                  </div>
                  <ConfidenceBadge confidence={a.confidence} />
                </div>
              ))}
              <div className="pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  Full details: <code>requirements/assumptions.md</code> · <code>requirements/open-questions.md</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
