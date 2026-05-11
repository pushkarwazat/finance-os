import app from "./app";
import { logger } from "./lib/logger";
import { setupContainer } from "./lib/container-setup.js";
import { seedVectorStore } from "./lib/vector-seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Wire real adapters into the DI container before accepting traffic.
await setupContainer();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed the vector store with mock chunks in the background after the
  // server is already accepting requests. This won't block startup.
  seedVectorStore().catch((err) => logger.error({ err }, "Vector seed failed"));
});
