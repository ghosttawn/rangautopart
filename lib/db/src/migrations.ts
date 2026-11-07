import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import type * as schema from "./schema";

// The RANG namespace keeps this transaction-level lock separate from other
// advisory locks used by applications sharing the same PostgreSQL server. It
// matches the lock used by the standalone `lib/db/migrate.mjs` runner so the
// two paths never apply migrations concurrently.
export const MIGRATION_LOCK_NAMESPACE = 0x52414e47;
export const MIGRATION_LOCK_ID = 1;

// Every table created by the committed migrations. Used to confirm the schema
// is complete before the API reports itself ready.
export const REQUIRED_TABLES = [
  "users",
  "auth_sessions",
  "password_reset_tokens",
  "categories",
  "products",
  "product_images",
  "product_compatibility",
  "carts",
  "cart_items",
  "orders",
  "order_items",
  "payments",
  "deliveries",
  "store_settings",
  "support_messages",
  "seed_runs",
] as const;

export type MigrationDatabase = NodePgDatabase<typeof schema>;

// Drizzle's public database type does not expose `dialect`/`session`, but both
// are present at runtime (the standalone `migrate.mjs` runner relies on the
// same shape). These structural types describe the runtime contract precisely.
type MigrationSession = {
  execute: (query: unknown) => Promise<unknown>;
  all: (query: unknown) => Promise<unknown[]>;
  transaction: (callback: (transaction: unknown) => Promise<unknown>) => Promise<unknown>;
};

type MigrationRuntime = {
  transaction: <T>(
    callback: (transaction: {
      execute: (query: unknown) => Promise<unknown>;
      session: { all: (query: unknown) => Promise<unknown[]> };
    }) => Promise<T>,
  ) => Promise<T>;
  dialect: {
    migrate: (
      migrations: MigrationMeta[],
      session: MigrationSession,
      config: { migrationsSchema: string; migrationsTable: string },
    ) => Promise<void>;
  };
};

export function loadMigrations(migrationsFolder: string): MigrationMeta[] {
  return readMigrationFiles({ migrationsFolder });
}

/**
 * Applies the given migrations inside a single transaction that first takes the
 * RANG migration advisory lock. The lock and all DDL share one session, so
 * concurrent API instances serialize instead of racing.
 */
export async function migrateWithAdvisoryLock(
  database: MigrationDatabase,
  migrations: MigrationMeta[],
): Promise<void> {
  const runtime = database as unknown as MigrationRuntime;

  await runtime.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`,
    );

    const migrationSession: MigrationSession = {
      execute: (query) => transaction.execute(query),
      all: (query) => transaction.session.all(query),
      transaction: (callback) => callback(transaction),
    };

    await runtime.dialect.migrate(migrations, migrationSession, {
      migrationsSchema: "drizzle",
      migrationsTable: "__drizzle_migrations",
    });
  });
}

export async function applyPendingMigrations(
  database: MigrationDatabase,
  migrationsFolder: string,
): Promise<number> {
  const migrations = loadMigrations(migrationsFolder);
  const before = await countAppliedMigrations(database);
  await migrateWithAdvisoryLock(database, migrations);
  const after = await countAppliedMigrations(database);
  return Math.max(after - before, 0);
}

/**
 * Reads how many migrations Drizzle has recorded. Returns 0 when the history
 * table does not exist yet (a fresh database), so callers can diff before and
 * after to report the number of migrations actually applied.
 */
async function countAppliedMigrations(
  database: MigrationDatabase,
): Promise<number> {
  try {
    const result = await database.execute(
      sql`select count(*)::int as total from drizzle.__drizzle_migrations`,
    );
    const rows =
      (result as unknown as { rows?: Array<{ total: number }> }).rows ?? [];
    return rows[0]?.total ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Confirms every required table exists in the `public` schema. Throws a
 * descriptive error (without exposing connection details) when the schema is
 * incomplete so the API refuses to report ready.
 */
export async function assertRequiredSchema(
  database: MigrationDatabase,
): Promise<void> {
  const result = await database.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `);
  const rows =
    (result as unknown as { rows?: Array<{ table_name: string }> }).rows ?? [];
  const present = new Set(rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new Error(
      `Database schema is incomplete; missing tables: ${missing.join(", ")}.`,
    );
  }
}
