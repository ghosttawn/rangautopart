import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "@workspace/db";
import {
  applyPendingMigrations,
  assertRequiredSchema,
} from "@workspace/db/migrations";
import { seedInitialStorefront, type StorefrontSeedResult } from "@workspace/db/seed";
import { logger } from "./logger";

/**
 * Automatic production database initialization.
 *
 * Runs once per API start, before the server accepts requests, so a fresh Neon
 * database becomes a usable application database through the normal Render
 * deployment with no manual steps:
 *   1. verify the connection to the configured PostgreSQL database;
 *   2. discover and apply every pending Drizzle migration in order;
 *   3. verify the required tables exist;
 *   4. safely populate the initial storefront when the catalog is empty.
 * The initial administrator is provisioned immediately afterwards (see
 * `ensureInitialAdmin`) and the server only starts serving once all of the
 * above succeeds. Every step is idempotent, so restarts and redeploys are safe.
 */

// The bundle lives in `artifacts/api-server/dist`. The build copies the
// migrations and the catalog image fixtures next to it so the deployed artifact
// is self-contained; the repository-relative paths are fallbacks for `tsx` runs.
const bundleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = process.cwd();

function resolveExistingDirectory(candidates: string[], marker: string): string {
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, marker))) {
      return candidate;
    }
  }
  throw new Error(
    `Could not locate a directory containing "${marker}". Looked in: ${candidates.join(", ")}.`,
  );
}

function resolveMigrationsDirectory(): string {
  return resolveExistingDirectory(
    [
      path.join(bundleDirectory, "drizzle"),
      path.resolve(bundleDirectory, "../../../lib/db/drizzle"),
      path.join(repositoryRoot, "lib/db/drizzle"),
    ],
    path.join("meta", "_journal.json"),
  );
}

function resolveImagesDirectory(): string {
  return resolveExistingDirectory(
    [
      path.join(bundleDirectory, "generated_images"),
      path.resolve(bundleDirectory, "../../../attached_assets/generated_images"),
      path.join(repositoryRoot, "attached_assets/generated_images"),
    ],
    "rang-hero.jpg",
  );
}

export type DatabaseInitializationReport = {
  migrationsApplied: number;
  seed: StorefrontSeedResult["status"];
};

export async function initializeDatabase(): Promise<DatabaseInitializationReport> {
  await pool.query("select 1");
  logger.info("Database connection verified");

  const migrationsApplied = await applyPendingMigrations(
    db,
    resolveMigrationsDirectory(),
  );
  logger.info(
    { migrations: migrationsApplied },
    "Database migrations are current",
  );

  await assertRequiredSchema(db);
  logger.info("Database schema verified");

  const seed = await seedInitialStorefront(db, {
    imageDirectory: resolveImagesDirectory(),
  });
  if (seed.status === "seeded") {
    logger.info(
      {
        categories: seed.categories,
        products: seed.products,
        fitments: seed.fitments,
      },
      "Initial storefront populated",
    );
  } else if (seed.status === "already-seeded") {
    logger.info("Initial storefront seed already applied");
  } else {
    logger.info("Storefront already has data; initial seed skipped");
  }

  return { migrationsApplied, seed: seed.status };
}
