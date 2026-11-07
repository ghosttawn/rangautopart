import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";
import {
  ADMIN_EMAIL_ENV,
  ADMIN_PASSWORD_ENV,
  ADMIN_ROLE,
  decideAdminBootstrap,
  type AdminBootstrapDecision,
} from "./admin-bootstrap-policy";

export * from "./admin-bootstrap-policy";

/**
 * Automatic initial-administrator bootstrap.
 *
 * The API calls {@link ensureInitialAdmin} once at startup, immediately after
 * {@link initializeDatabase} has applied the database migrations and verified
 * the schema. It runs on every start but only ever creates an administrator
 * when none exists yet, so redeploys never duplicate or overwrite an existing
 * administrator.
 */

// Transaction-level advisory lock that serializes the bootstrap across
// concurrently starting API instances. The ids are separate from the
// migration lock so the two operations do not block each other.
const BOOTSTRAP_LOCK_NAMESPACE = 0x52414e47; // "RANG"
const BOOTSTRAP_LOCK_ID = 2;

export type AdminBootstrapOutcome =
  | { action: "skip"; reason: string }
  | { action: "created"; email: string; source: "environment" | "development-fallback" }
  | { action: "error"; message: string };

function toOutcome(decision: AdminBootstrapDecision): AdminBootstrapOutcome {
  switch (decision.action) {
    case "skip":
      return { action: "skip", reason: decision.reason };
    case "create":
      return { action: "created", email: decision.email, source: decision.source };
    case "error":
      return { action: "error", message: decision.message };
  }
}

/**
 * Ensures an initial administrator exists. Idempotent: it only inserts a new
 * administrator when none exists and never resets an existing account.
 *
 * Throws a descriptive error when the configuration is invalid or, in
 * production, when no administrator exists and no credentials are configured.
 */
export async function ensureInitialAdmin(): Promise<AdminBootstrapOutcome> {
  const outcome = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${BOOTSTRAP_LOCK_NAMESPACE}, ${BOOTSTRAP_LOCK_ID})`,
    );

    const [adminCount] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(usersTable)
      .where(eq(usersTable.role, ADMIN_ROLE));
    if ((adminCount?.total ?? 0) > 0) {
      return toOutcome(decideAdminBootstrap({
        environment: process.env.NODE_ENV,
        email: undefined,
        password: undefined,
        existingAdminCount: 1,
        emailTakenByNonAdmin: false,
      }));
    }

    const rawEmail = process.env[ADMIN_EMAIL_ENV];
    const rawPassword = process.env[ADMIN_PASSWORD_ENV];
    const normalizedEmail = (rawEmail ?? "").trim().toLowerCase();

    let emailTakenByNonAdmin = false;
    if (normalizedEmail.length > 0) {
      const [existing] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`)
        .limit(1);
      emailTakenByNonAdmin = Boolean(existing);
    }

    const decision = decideAdminBootstrap({
      environment: process.env.NODE_ENV,
      email: rawEmail,
      password: rawPassword,
      existingAdminCount: 0,
      emailTakenByNonAdmin,
    });

    if (decision.action !== "create") {
      return toOutcome(decision);
    }

    // The password is hashed with the same scrypt scheme used by the rest of
    // the authentication system; the plaintext is never stored.
    const passwordHash = await hashPassword(decision.password);
    await tx.insert(usersTable).values({
      id: randomUUID(),
      email: decision.email,
      name: decision.name,
      role: ADMIN_ROLE,
      passwordHash,
    });
    return toOutcome(decision);
  });

  if (outcome.action === "error") {
    throw new Error(outcome.message);
  }

  if (outcome.action === "skip") {
    logger.info({ reason: outcome.reason }, "Administrator bootstrap skipped");
  } else if (outcome.source === "development-fallback") {
    logger.warn(
      { email: outcome.email },
      `Created the development administrator from documented fallback credentials. Set ${ADMIN_EMAIL_ENV} and ${ADMIN_PASSWORD_ENV} to use your own development credentials. This fallback is never used in production.`,
    );
  } else {
    logger.info(
      { email: outcome.email },
      "Created the initial administrator account from environment variables",
    );
  }

  return outcome;
}
