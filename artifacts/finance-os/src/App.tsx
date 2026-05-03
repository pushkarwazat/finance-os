import { AppLayout } from "@/components/layout"
import { Switch, Route, Router as WouterRouter } from "wouter"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import NotFound from "@/pages/not-found"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/context/auth"
import { ProtectedRoute } from "@/components/protected-route"

// Import pages
import { MetricsPage } from "@/pages/metrics"
import { AskPage } from "@/pages/ask"
import { VariancePage } from "@/pages/variance"
import { ClosePage } from "@/pages/close"
import { DocumentsPage } from "@/pages/documents"
import { GovernancePage } from "@/pages/governance"
import { EvalsPage } from "@/pages/evals"
import { GlossaryPage } from "@/pages/glossary"
import { AgentsPage } from "@/pages/agents"
import { ApprovalsPage } from "@/pages/approvals"
import { ExceptionsPage } from "@/pages/exceptions"
import { BudgetPage } from "@/pages/budget"
import { TreasuryPage } from "@/pages/treasury"
import { ConsolidationPage } from "@/pages/consolidation"
import { RequirementsInspectorPage } from "@/pages/requirements-inspector"
import { ExecutiveDashboardPage } from "@/pages/executive-dashboard"
import { ReportingCenterPage } from "@/pages/reporting-center"
import { ForecastingWorkbenchPage } from "@/pages/forecasting-workbench"
import { ScenarioLabPage } from "@/pages/scenario-lab"
import { AiInsightsPage } from "@/pages/ai-insights"
import { MarginOptimizationPage } from "@/pages/margin-optimization"
import { CostReductionPage } from "@/pages/cost-reduction"
import { BoardPackPage } from "@/pages/board-pack"
import { ReportBuilderPage } from "@/pages/report-builder"
import { InsightDetailPage } from "@/pages/insight-detail"
import { RecommendationReviewPage } from "@/pages/recommendation-review"

const queryClient = new QueryClient()

function Router() {
  return (
    <AppLayout>
      <ProtectedRoute>
        <Switch>
          <Route path="/" component={MetricsPage} />
          <Route path="/metrics" component={MetricsPage} />
          <Route path="/ask" component={AskPage} />
          <Route path="/variance" component={VariancePage} />
          <Route path="/close" component={ClosePage} />
          <Route path="/documents" component={DocumentsPage} />
          <Route path="/governance" component={GovernancePage} />
          <Route path="/evals" component={EvalsPage} />
          <Route path="/glossary" component={GlossaryPage} />
          <Route path="/agents" component={AgentsPage} />
          <Route path="/approvals" component={ApprovalsPage} />
          <Route path="/exceptions" component={ExceptionsPage} />
          <Route path="/budget" component={BudgetPage} />
          <Route path="/treasury" component={TreasuryPage} />
          <Route path="/consolidation" component={ConsolidationPage} />
          <Route path="/requirements" component={RequirementsInspectorPage} />
          <Route path="/executive-dashboard" component={ExecutiveDashboardPage} />
          <Route path="/reporting" component={ReportingCenterPage} />
          <Route path="/forecasting" component={ForecastingWorkbenchPage} />
          <Route path="/scenarios" component={ScenarioLabPage} />
          <Route path="/ai-insights" component={AiInsightsPage} />
          <Route path="/margin-optimization" component={MarginOptimizationPage} />
          <Route path="/cost-reduction" component={CostReductionPage} />
          <Route path="/board-pack" component={BoardPackPage} />
          <Route path="/report-builder" component={ReportBuilderPage} />
          <Route path="/insights/:id" component={InsightDetailPage} />
          <Route path="/recommendations" component={RecommendationReviewPage} />
          <Route component={NotFound} />
        </Switch>
      </ProtectedRoute>
    </AppLayout>
  )
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
