import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, FileText, Calendar, BarChart2 } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchTemplates() {
  const res = await fetch(`${BASE}api/reporting/templates`)
  if (!res.ok) throw new Error("Failed to fetch templates")
  return res.json()
}

async function fetchRuns() {
  const res = await fetch(`${BASE}api/reporting/runs`)
  if (!res.ok) throw new Error("Failed to fetch runs")
  return res.json()
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-muted text-muted-foreground border-border", label: "Draft" },
    under_review: { cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Under Review" },
    approved: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Approved" },
    published: { cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Published" },
    rejected: { cls: "bg-red-500/15 text-red-400 border-red-500/30", label: "Rejected" },
  }
  const s = map[status] ?? { cls: "bg-muted text-muted-foreground border-border", label: status }
  return <Badge className={`${s.cls} text-xs`}>{s.label}</Badge>
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === "pending") return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  )
  if (status === "approved") return (
    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </Badge>
  )
  return <Badge variant="outline" className="text-xs">N/A</Badge>
}

function CadenceBadge({ cadence }: { cadence: string }) {
  const colors: Record<string, string> = {
    weekly: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    monthly: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    quarterly: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  }
  return <Badge className={`${colors[cadence] ?? "bg-muted text-muted-foreground"} text-xs capitalize`}>{cadence}</Badge>
}

export function ReportingCenterPage() {
  const qc = useQueryClient()
  const templates = useQuery({ queryKey: ["reporting-templates"], queryFn: fetchTemplates })
  const runs = useQuery({ queryKey: ["reporting-runs"], queryFn: fetchRuns })

  const triggerRun = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`${BASE}api/reporting/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fiscalPeriod: "2026-Q1", requestedBy: "user" }),
      })
      if (!res.ok) throw new Error("Failed to trigger run")
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reporting-runs"] }),
  })

  const templateList: {
    id: string; name: string; reportType: string; version: string; cadence: string;
    owner: string; exportModes: string[]; requiresApprovalBeforeDistribution: boolean
  }[] = templates.data?.data ?? []

  const runList: {
    id: string; templateName: string; fiscalPeriod: string; status: string;
    narrativeApprovalStatus: string; lastRefreshedAt: string
  }[] = runs.data?.data ?? []

  const runSummary = runs.data?.summary

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Report templates · Run management · Narrative approval workflow
        </p>
      </div>

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertDescription className="text-amber-300 text-sm">
          All AI-generated narratives require human review before distribution. Reports with
          <code className="mx-1 text-xs">requiresApprovalBeforeDistribution=true</code>
          are blocked until the CFO or Controller approves.
        </AlertDescription>
      </Alert>

      {/* Live reports */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Live Reports</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/reporting/pl">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-start gap-3">
                <BarChart2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium">P&amp;L Drilldown</div>
                  <div className="text-xs text-muted-foreground mt-0.5">GAAP L1 → L4 · Budget vs Actuals · FY2026</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Run summary */}
      {runSummary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Runs", value: runSummary.totalRuns },
            { label: "Pending Approval", value: runSummary.pendingApproval, warn: runSummary.pendingApproval > 0 },
            { label: "Approved", value: runSummary.approved },
            { label: "Published", value: runSummary.published },
          ].map((s) => (
            <Card key={s.label} className={s.warn ? "border-amber-500/30" : ""}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-bold mt-1 ${s.warn ? "text-amber-400" : ""}`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent runs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Report Runs</CardTitle>
          <CardDescription>Latest generated reports and their approval status</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-3">
              {runList.map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{run.templateName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{run.fiscalPeriod}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <ApprovalBadge status={run.narrativeApprovalStatus} />
                    <StatusBadge status={run.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Templates */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Report Templates</h2>
        {templates.isLoading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <Card key={i}><CardContent className="p-4"><div className="h-10 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}</div>
        ) : (
          <div className="space-y-3">
            {templateList.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground">v{t.version}</span>
                        <CadenceBadge cadence={t.cadence} />
                        {t.requiresApprovalBeforeDistribution && (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
                            <Clock className="h-3 w-3" /> Approval required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">Owner: {t.owner}</span>
                        <span className="text-xs text-muted-foreground">Exports: {t.exportModes.join(", ")}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={triggerRun.isPending}
                      onClick={() => triggerRun.mutate(t.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
