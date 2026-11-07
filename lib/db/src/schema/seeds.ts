import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const seedRunsTable = pgTable("seed_runs", {
  seedKey: text("seed_key").primaryKey(),
  version: integer("version").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
