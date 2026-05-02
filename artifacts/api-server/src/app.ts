import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middlewares/request-id.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.js";

const app: Express = express();

// 1. Structured request logging (must be first to capture all requests)
app.use(
  pinoHttp({
    logger,
    // Propagate upstream X-Request-Id into pino-http so every log line carries it.
    // The requestIdMiddleware below also sets res.locals.requestId for route handlers.
    genReqId: (req) => {
      const existing = req.headers["x-request-id"] ?? req.headers["x-correlation-id"];
      if (typeof existing === "string" && existing.length > 0) return existing;
      return crypto.randomUUID();
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// 2. Attach requestId + traceId to res.locals and response headers
app.use(requestIdMiddleware);

// 3. Security / parsing middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Application routes
app.use("/api", router);

// 5. Centralised error handler — MUST be last
app.use(errorHandlerMiddleware);

export default app;
