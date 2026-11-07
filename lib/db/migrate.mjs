import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";

const { Pool } = pg;
const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(databaseDirectory, "drizzle");

// The RANG namespace keeps this transaction-level lock separate from other
// advisory locks used by applications sharing the same PostgreSQL server.
const MIGRATION_LOCK_NAMESPACE = 0x52414e47;
const MIGRATION_LOCK_ID = 1;

export async function migrateWithAdvisoryLock(database, migrations) {
  await database.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`,
    );

    // Reuse Drizzle's migration implementation, but bind its transaction to
    // the already-locked transaction so the lock and all DDL share one session.
    const migrationSession = {
      execute: (query) => transaction.execute(query),
      all: (query) => transaction.session.all(query),
      transaction: (callback) => callback(transaction),
    };

    await database.dialect.migrate(migrations, migrationSession, {
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  });
}

function safeErrorMessage(error) {
  const rawMessage =
    error instanceof Error ? error.message : "Unknown migration error.";

  return rawMessage
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi, "[redacted database URL]")
    .replace(
      /\b(password|passwd|pwd)\s*=\s*("[^"]*"|'[^']*'|[^;\s]+)/gi,
      "$1=[redacted]",
    )
    .slice(0, 2_000);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Database migrations require DATABASE_URL.");
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  });

  try {
    process.stdout.write("Checking and applying pending Drizzle migrations.\n");
    await migrateWithAdvisoryLock(drizzle(pool), migrations);
    process.stdout.write("Drizzle migrations are current.\n");
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? ` (code ${String(error.code).slice(0, 32)})`
        : "";
    process.stderr.write(
      `Database migration failed${code}: ${safeErrorMessage(error)}\n`,
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
