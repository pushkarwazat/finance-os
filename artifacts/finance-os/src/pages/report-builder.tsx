import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Info, Play, CheckCircle2, AlertTriangle } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchTemplates() {
  const res = await fetch(`${BASE}api/reporting/templates`)
  if (!res.ok) throw new Error("Failed to fetch templates")
  return res.json()
}

const FISCAL_PERIODS = ["2026-Q1", "2026-Q2", "2026-W17", "2026-W18", "FY2025", "FY2026"]

function TemplateBadge({ reportType }: { reportType: string }) {
  const colors: Record<string, string> = {
    executive_summary: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    board_deck_data_pack: "bg-red-500/15 text-red-400 border-red-500/30",
    weekly_flash: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    budget_vs_actual: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    margin_waterfall: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    cost_optimization: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  }
  const label = reportType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  return <Badge className={`${colors[reportType] ?? "bg-muted text-muted-foreground"} text-xs`}>{label}</Badge>
}

export function ReportBuilderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>("2026-Q1")
  const [result, setResult] = useState<{ id: string; templateName: string; status: string } | null>(null)

  const templates = useQuery({ queryKey: ["reporting-templates-builder"], queryFn: fetchTemplates })

  const triggerRun = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) throw new Error("No template selected")
      const res = await fetch(`${BASE}api/reporting/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selectedTemplate, fiscalPeriod: selectedPeriod, requestedBy: "user" }),
      })
      if (!res.ok) throw new Error("Failed to run report")
      return res.json()
    },
    onSuccess: (data) => setResult(data.run),
  })

  const templateList: {
    id: string; name: string; reportType: string; version: string; cadence: string;
    requiresApprovalBeforeDistribution: boolean; exportModes: string[]
  }[] = templates.data?.data ?? []

  const selected = templateList.find((t) => t.id === selectedTemplate)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Report Builder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a template and fiscal period to generate a new report run
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-300 text-sm">
          Reports requiring approval will enter the review queue. AI-generated narratives are marked
          as drafts and require human approval before distribution.
        </AlertDescription>
      </Alert>

      {result && (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <AlertDescription className="text-emerald-300 text-sm">
            Report run <strong>{result.id}</strong> queued successfully.
            Status: <strong>{result.status}</strong>.
            {result.templateName && <> Template: <strong>{result.templateName}</strong>.</>}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Template selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">1. Select Template</CardTitle>
            <CardDescription>Choose from available report templates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.isLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded animate-pulse" />)}</div>
            ) : (
              templateList.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedTemplate === t.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30 bg-muted/10"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <TemplateBadge reportType={t.reportType} />
                        <Badge variant="outline" className="text-xs capitalize">{t.cadence}</Badge>
                      </div>
                    </div>
                    {selectedTemplate === t.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">2. Select Fiscal Period</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {FISCAL_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${selectedPeriod === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/10 hover:border-primary/30"}`}
                >
                  {p}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Template details */}
          {selected && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Template Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span>v{selected.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cadence</span>
                  <span className="capitalize">{selected.cadence}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Export modes</span>
                  <span className="text-xs">{selected.exportModes.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approval required</span>
                  {selected.requiresApprovalBeforeDistribution ? (
                    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">Yes</Badge>
                  ) : (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">No</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <Button
            className="w-full"
            disabled={!selectedTemplate || triggerRun.isPending}
            onClick={() => triggerRun.mutate()}
          >
            {triggerRun.isPending ? (
              "Queuing report..."
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Generate Report</>
            )}
          </Button>

          {triggerRun.isError && (
            <Alert className="border-red-500/30 bg-red-500/5">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300 text-sm">
                Failed to generate report. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
