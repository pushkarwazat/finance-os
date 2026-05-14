import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { requestIdMiddleware } from "./middlewares/request-id.js";
import { authenticateMiddleware } from "./middlewares/authenticate.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.js";

const app: Express = express();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Structured request logging (must be first to capture all requests)
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  pinoHttp({
    logger,
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. Request ID + Trace ID
// ─────────────────────────────────────────────────────────────────────────────

app.use(requestIdMiddleware);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Security headers (helmet)
//    Content-Security-Policy is relaxed slightly for the API-only server;
//    tighten further once a real IdP is connected.
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. CORS — allow the Replit proxy domain and localhost dev ports
//    REPLIT_DOMAINS is a comma-separated list set by the Replit runtime.
// ─────────────────────────────────────────────────────────────────────────────

const replitDomains = (process.env.REPLIT_DOMAINS ?? "")
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => `https://${d}`);

const allowedOrigins = new Set<string>([
  ...replitDomains,
  "http://localhost:80",
  "http://localhost:5173",
  "http://localhost:24160",
  "http://localhost:8080",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, healthchecks)
      if (!origin) return callback(null, true);
      const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
      if (
        (process.env.NODE_ENV === "development" && isLocalhost) ||
        allowedOrigins.has(origin) ||
        origin.endsWith(".replit.dev") ||
        origin.endsWith(".repl.co") ||
        origin.endsWith(".kirk.replit.dev")
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin '${origin}' is not allowed`));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "X-Trace-Id"],
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Body parsing
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// 6. Authentication — applied to every /api route except /api/healthz
//    /api/healthz must remain public for load-balancer and uptime probes.
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api", (req, res, next) => {
  if (req.path === "/healthz") return next();
  return authenticateMiddleware(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Application routes
// ─────────────────────────────────────────────────────────────────────────────

app.use("/api", router);

// ─────────────────────────────────────────────────────────────────────────────
// 8. Static frontend — serve built React app if STATIC_DIR is set
//    SPA fallback sends index.html for all non-API routes.
// ─────────────────────────────────────────────────────────────────────────────

if (process.env.STATIC_DIR) {
  const staticDir = path.resolve(process.env.STATIC_DIR);
  app.use(express.static(staticDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Centralised error handler — MUST be last
// ─────────────────────────────────────────────────────────────────────────────

app.use(errorHandlerMiddleware);

export default app;
