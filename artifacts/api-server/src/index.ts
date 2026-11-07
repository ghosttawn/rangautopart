import app from "./app";
import { ensureInitialAdmin } from "./lib/admin-bootstrap";
import { initializeDatabase } from "./lib/database-init";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const port = Number(process.env["PORT"] ?? 5000);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"] ?? 5000}"`);
}

// Prepare the production database before serving any request: verify the
// connection, apply pending migrations, confirm the schema, and safely seed the
// initial storefront. Then provision the initial administrator. Every step is
// idempotent, so this runs safely on a fresh database, a restart, or a redeploy.
try {
  await initializeDatabase();
  await ensureInitialAdmin();
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Database initialization failed.";
  logger.error(
    { message },
    "Database initialization failed; refusing to start",
  );
  process.stderr.write(`\nDatabase initialization failed: ${message}\n\n`);
  await pool.end().catch(() => undefined);
  process.exit(1);
}

const server = app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Server shutdown failed");
      process.exitCode = 1;
    }
    void pool.end().catch((poolError: unknown) => {
      logger.error({ err: poolError }, "Database pool shutdown failed");
      process.exitCode = 1;
    });
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
