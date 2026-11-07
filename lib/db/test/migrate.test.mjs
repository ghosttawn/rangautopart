import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrateWithAdvisoryLock } from "../migrate.mjs";

const databaseDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function createFakeDatabase({ migrationError } = {}) {
  const events = [];
  const transaction = {
    async execute() {
      events.push("execute");
    },
    session: {
      async all() {
        events.push("all");
        return [];
      },
    },
  };

  return {
    events,
    database: {
      async transaction(callback) {
        events.push("begin");
        try {
          const result = await callback(transaction);
          events.push("commit");
          return result;
        } catch (error) {
          events.push("rollback");
          throw error;
        }
      },
      dialect: {
        async migrate(migrations, session, config) {
          events.push("migrate");
          assert.equal(config.migrationsSchema, "drizzle");
          assert.equal(config.migrationsTable, "__drizzle_migrations");
          assert.equal(migrations.length, 1);
          await session.all("migration history");
          await session.transaction(async (lockedTransaction) => {
            assert.equal(lockedTransaction, transaction);
            await lockedTransaction.execute("migration statement");
          });
          if (migrationError) {
            throw migrationError;
          }
          events.push("migrated");
        },
      },
    },
  };
}

test("loads the committed Drizzle migrations in journal order", () => {
  const migrations = readMigrationFiles({
    migrationsFolder: path.join(databaseDirectory, "drizzle"),
  });

  assert.equal(migrations.length, 5);
  assert.deepEqual(
    migrations.map((migration) => migration.folderMillis),
    [...migrations.map((migration) => migration.folderMillis)].sort(
      (left, right) => left - right,
    ),
  );
  assert.ok(migrations.every((migration) => migration.hash.length === 64));
});

test("acquires the migration lock before running migrations in one transaction", async () => {
  const { database, events } = createFakeDatabase();

  await migrateWithAdvisoryLock(database, [{ folderMillis: 1 }]);

  assert.deepEqual(events, [
    "begin",
    "execute",
    "migrate",
    "all",
    "execute",
    "migrated",
    "commit",
  ]);
});

test("propagates migration failures so the transaction rolls back", async () => {
  const failure = new Error("migration failed");
  const { database, events } = createFakeDatabase({ migrationError: failure });

  await assert.rejects(
    migrateWithAdvisoryLock(database, [{ folderMillis: 1 }]),
    failure,
  );
  assert.deepEqual(events, [
    "begin",
    "execute",
    "migrate",
    "all",
    "execute",
    "rollback",
  ]);
});
