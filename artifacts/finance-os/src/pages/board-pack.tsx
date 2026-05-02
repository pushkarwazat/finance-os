import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Shield, CheckCircle2, Clock, FileText, Lock } from "lucide-react"

const BASE = import.meta.env.BASE_URL

async function fetchBoardPacks() {
  const res = await fetch(`${BASE}api/reporting/board-packs`)
  if (!res.ok) throw new Error("Failed to fetch board packs")
  return res.json()
}

async function fetchRuns() {
  const res = await fetch(`${BASE}api/reporting/runs?status=approved`)
  if (!res.ok) throw new Error("Failed to fetch runs")
  return res.json()
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>
  if (status === "published") return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">Published</Badge>
  if (status === "draft") return <Badge className="bg-muted text-muted-foreground border-border text-xs">Draft</Badge>
  if (status === "under_review") return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1"><Clock className="h-3 w-3" /> Under Review</Badge>
  return <Badge variant="outline" className="text-xs capitalize">{status}</Badge>
}

function ConfidentialityBadge({ level }: { level: string }) {
  if (level === "board_only") return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs gap-1">
      <Lock className="h-3 w-3" /> Board Only
    </Badge>
  )
  if (level === "confidential") return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs gap-1">
      <Shield className="h-3 w-3" /> Confidential
    </Badge>
  )
  return <Badge variant="outline" className="text-xs capitalize">{level}</Badge>
}

export function BoardPackPage() {
  const boardPacks = useQuery({ queryKey: ["board-packs"], queryFn: fetchBoardPacks })
  const runs = useQuery({ queryKey: ["reporting-runs-approved"], queryFn: fetchRuns })

  const packList: {
    id: string; title: string; fiscalPeriod: string; preparedBy: string;
    approvedBy: string; approvedAt: string; status: string; confidentiality: string;
    sections: string[]; executiveSummary: string; exportReadyAt: string
  }[] = boardPacks.data?.data ?? []

  const runList: {
    id: string; templateName: string; fiscalPeriod: string; status: string;
    narrativeApprovalStatus: string
  }[] = runs.data?.data ?? []

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Board Pack Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Board-ready data packs · Confidential distribution · Export to PDF / PPT
        </p>
      </div>

      <Alert className="border-red-500/30 bg-red-500/5">
        <Shield className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-300 text-sm">
          Board packs are classified <strong>Board Only</strong>. Access restricted to board members, CEO, and CFO.
          Distribution requires explicit CFO approval. Do not share outside this system.
        </AlertDescription>
      </Alert>

      {/* Board packs */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Board Packs</h2>
        {boardPacks.isLoading ? (
          <div className="space-y-4">{[1,2].map(i => <Card key={i}><CardContent className="p-4"><div className="h-40 bg-muted/30 rounded animate-pulse" /></CardContent></Card>)}</div>
        ) : (
          <div className="space-y-4">
            {packList.map((pack) => (
              <Card key={pack.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{pack.title}</CardTitle>
                      <CardDescription>{pack.fiscalPeriod} · Prepared by {pack.preparedBy}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ConfidentialityBadge level={pack.confidentiality} />
                      <StatusBadge status={pack.status} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-1.5">Executive Summary</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{pack.executiveSummary}</p>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-xs text-muted-foreground font-medium mb-2">Sections ({pack.sections.length})</div>
                    <div className="flex flex-wrap gap-2">
                      {pack.sections.map((s) => (
                        <div key={s} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted/30 border border-border">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Approved by: {pack.approvedBy} on {new Date(pack.approvedAt).toLocaleDateString()}</span>
                    <span>Export ready: {new Date(pack.exportReadyAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Supporting approved reports */}
      {runList.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Supporting Approved Reports</h2>
          <div className="space-y-2">
            {runList.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/10">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{r.templateName}</span>
                  <span className="text-xs text-muted-foreground">{r.fiscalPeriod}</span>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
