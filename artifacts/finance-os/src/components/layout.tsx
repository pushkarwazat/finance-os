import { Link, useLocation } from "wouter"
import { BarChart3, MessageSquare, LineChart, CheckSquare, FileText, Shield, Activity, BookOpen, Settings, Bot, ShieldAlert, AlertTriangle, DollarSign, Landmark, GitMerge, ClipboardList, LayoutDashboard, FileBarChart2, TrendingUp, Layers, Lightbulb, Target, Scissors, Presentation, Hammer, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { useAuth } from "@/context/auth"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar"

const navigation = [
  { name: "Exec Dashboard", href: "/executive-dashboard", icon: LayoutDashboard },
  { name: "Metrics", href: "/metrics", icon: BarChart3 },
  { name: "Ask AI", href: "/ask", icon: MessageSquare },
  { name: "Variance", href: "/variance", icon: LineChart },
  { name: "Close", href: "/close", icon: CheckSquare },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Governance", href: "/governance", icon: Shield },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Approvals", href: "/approvals", icon: ShieldAlert },
  { name: "Exceptions", href: "/exceptions", icon: AlertTriangle },
  { name: "Budget", href: "/budget", icon: DollarSign },
  { name: "Treasury", href: "/treasury", icon: Landmark },
  { name: "Consolidation", href: "/consolidation", icon: GitMerge },
  { name: "Reporting", href: "/reporting", icon: FileBarChart2 },
  { name: "Forecasting", href: "/forecasting", icon: TrendingUp },
  { name: "Scenario Lab", href: "/scenarios", icon: Layers },
  { name: "AI Insights", href: "/ai-insights", icon: Lightbulb },
  { name: "Margin Opt.", href: "/margin-optimization", icon: Target },
  { name: "Cost Reduction", href: "/cost-reduction", icon: Scissors },
  { name: "Board Pack", href: "/board-pack", icon: Presentation },
  { name: "Report Builder", href: "/report-builder", icon: Hammer },
  { name: "Recommendations", href: "/recommendations", icon: ListChecks },
  { name: "Evals", href: "/evals", icon: Activity },
  { name: "Glossary", href: "/glossary", icon: BookOpen },
  { name: "Requirements", href: "/requirements", icon: ClipboardList },
]

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  cfo: "CFO",
  controller: "Controller",
  finance_manager: "Fin. Manager",
  analyst: "Analyst",
  operator: "Operator",
  auditor: "Auditor",
  viewer: "Viewer",
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-sidebar">
          <SidebarHeader className="h-16 flex items-center px-4 border-b border-border">
            <div className="flex items-center gap-2 font-bold text-sidebar-foreground">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground">F</div>
              <span>FinanceOS</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4">
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location === item.href || (location === "/" && item.href === "/metrics")
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.name}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-border">
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                {user?.initials ?? "—"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                  {user?.name ?? "Loading…"}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">
                  {user ? (ROLE_LABELS[user.role] ?? user.role) : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground shrink-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <h1 className="text-sm font-medium text-foreground capitalize">
                {location === "/" ? "Metrics" : location.split("/")[1].replace("-", " ")}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">Q3 FY24</div>
            </div>
          </header>
          
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
