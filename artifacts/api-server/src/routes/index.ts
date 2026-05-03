import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import metricsRouter from "./metrics.js";
import askRouter from "./ask.js";
import varianceRouter from "./variance.js";
import closeRouter from "./close.js";
import documentsRouter from "./documents.js";
import governanceRouter from "./governance.js";
import evalsRouter from "./evals.js";
import agentsRouter from "./agents.js";
import semanticRouter from "./semantic.js";
import analyticsRouter from "./analytics.js";
import ragRouter from "./rag.js";
import workflowsRouter from "./workflows.js";
import budgetRouter from "./budget.js";
import treasuryRouter from "./treasury.js";
import consolidationRouter from "./consolidation.js";
import requirementsRouter from "./requirements.js";
import reportingRouter from "./reporting.js";
import forecastingRouter from "./forecasting.js";
import insightsRouter from "./insights.js";
import meRouter from "./me.js";
import auditLogRouter from "./audit-log.js";

const router: IRouter = Router();

// Public (auth handled at app.ts level — healthz is already exempted)
router.use(healthRouter);

// Authenticated identity
router.use(meRouter);

// Audit log (governance:read required inside the route handler)
router.use(auditLogRouter);

// Core finance routes
router.use(metricsRouter);
router.use(askRouter);
router.use(varianceRouter);
router.use(closeRouter);
router.use(documentsRouter);
router.use(governanceRouter);
router.use(evalsRouter);
router.use(agentsRouter);
router.use(semanticRouter);
router.use(analyticsRouter);
router.use(ragRouter);
router.use(workflowsRouter);
router.use(budgetRouter);
router.use(treasuryRouter);
router.use(consolidationRouter);
router.use(requirementsRouter);

// Analytics phase-3 routes
router.use(reportingRouter);
router.use(forecastingRouter);
router.use(insightsRouter);

export default router;
