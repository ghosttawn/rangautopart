import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { hashPassword, revokeUserSessions } from "../lib/auth";

const RECOVERY_MODE = "recover";

async function main() {
  const environment = process.env.NODE_ENV;
  const confirmation = environment === "production" ? "production" : "development";
  if (
    (environment !== "development" && environment !== "production") ||
    process.env.RANG_ADMIN_PROVISION_CONFIRM !== confirmation
  ) {
    throw new Error(
      "Set NODE_ENV and RANG_ADMIN_PROVISION_CONFIRM to the same explicit value (development or production).",
    );
  }

  const mode = process.argv[3];
  if (mode !== undefined && mode !== RECOVERY_MODE) {
    throw new Error(
      `Unknown mode "${mode}". Use no mode to provision a new administrator, or "${RECOVERY_MODE}" to reset an existing account's password.`,
    );
  }

  if (environment === "production" && !process.argv[2]) {
    throw new Error("Provide the intended administrator email explicitly in production.");
  }
  const email = (process.argv[2] ?? "rang.admin@rang-auto-parts.test").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Provide a valid administrator email address.");
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  // Deliberate, protected recovery: only runs when the operator passes the
  // explicit "recover" mode AND the confirmation environment variable. It is
  // never part of deployment, so it can never silently reset credentials.
  if (mode === RECOVERY_MODE) {
    if (!existing) {
      throw new Error(
        "No account exists for that email. Provision a new administrator without the recovery mode instead.",
      );
    }
    const temporaryPassword = randomBytes(18).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);
    await db
      .update(usersTable)
      .set({
        passwordHash,
        role: "admin",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.id));
    await revokeUserSessions(existing.id);
    process.stdout.write(
      [
        "Administrator password recovered.",
        `Email: ${existing.email}`,
        `Temporary password: ${temporaryPassword}`,
        "All existing sessions for this account were revoked.",
        "Sign in at /admin/login and change the password from Account settings immediately.",
        "",
      ].join("\n"),
    );
    return;
  }

  if (existing?.passwordHash) {
    throw new Error(
      "An account with a password already exists for this email. Use the account's password-change flow, or run this command with the explicit \"recover\" mode to deliberately reset it.",
    );
  }

  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  if (existing) {
    await db
      .update(usersTable)
      .set({
        passwordHash,
        role: "admin",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existing.id));
    await revokeUserSessions(existing.id);
  } else {
    await db.insert(usersTable).values({
      id: randomUUID(),
      email,
      name: environment === "production" ? "RANG Administrator" : "RANG Development Admin",
      role: "admin",
      passwordHash,
    });
  }

  process.stdout.write(
    [
      `${environment === "production" ? "Production" : "Development"} administrator provisioned.`,
      `Email: ${email}`,
      `Temporary password: ${temporaryPassword}`,
      "Sign in at /admin/login, then change the password from Account settings.",
      "",
    ].join("\n"),
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Administrator provisioning failed."}\n`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
