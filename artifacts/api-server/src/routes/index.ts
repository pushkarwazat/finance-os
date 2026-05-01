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

const router: IRouter = Router();

router.use(healthRouter);
router.use(metricsRouter);
router.use(askRouter);
router.use(varianceRouter);
router.use(closeRouter);
router.use(documentsRouter);
router.use(governanceRouter);
router.use(evalsRouter);
router.use(agentsRouter);

export default router;
