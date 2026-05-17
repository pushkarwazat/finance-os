import { Card, CardContent } from "@/components/ui/card"
import { BarChart2 } from "lucide-react"
import { Link } from "wouter"

export function ReportingCenterPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reporting Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Live reports · FY2026</p>
      </div>

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
  )
}
