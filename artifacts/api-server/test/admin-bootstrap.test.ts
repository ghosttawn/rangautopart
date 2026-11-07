import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_EMAIL_ENV,
  ADMIN_PASSWORD_ENV,
  DEVELOPMENT_FALLBACK_ADMIN_EMAIL,
  DEVELOPMENT_FALLBACK_ADMIN_PASSWORD,
  decideAdminBootstrap,
} from "../src/lib/admin-bootstrap-policy.ts";

const VALID_EMAIL = "owner@rang-auto-parts.example";
const VALID_PASSWORD = "a-strong-admin-password";

function base(overrides: Partial<Parameters<typeof decideAdminBootstrap>[0]> = {}) {
  return {
    environment: "production",
    email: undefined,
    password: undefined,
    existingAdminCount: 0,
    emailTakenByNonAdmin: false,
    ...overrides,
  };
}

test("an existing administrator is always preserved and never recreated", () => {
  assert.deepEqual(
    decideAdminBootstrap(base({ existingAdminCount: 1, email: VALID_EMAIL, password: VALID_PASSWORD })),
    {
      action: "skip",
      reason: "An administrator account already exists; it is left unchanged.",
    },
  );
});

test("production without credentials fails with an actionable error naming the variables", () => {
  const decision = decideAdminBootstrap(base());
  assert.equal(decision.action, "error");
  if (decision.action !== "error") return;
  assert.match(decision.message, new RegExp(ADMIN_EMAIL_ENV));
  assert.match(decision.message, new RegExp(ADMIN_PASSWORD_ENV));
});

test("production with valid credentials creates the administrator from the environment", () => {
  const decision = decideAdminBootstrap(
    base({ email: `  ${VALID_EMAIL.toUpperCase()}  `, password: VALID_PASSWORD }),
  );
  assert.deepEqual(decision, {
    action: "create",
    email: VALID_EMAIL,
    password: VALID_PASSWORD,
    name: "RANG Administrator",
    source: "environment",
  });
});

test("production rejects a partially configured credential pair", () => {
  const emailOnly = decideAdminBootstrap(base({ email: VALID_EMAIL }));
  assert.equal(emailOnly.action, "error");
  const passwordOnly = decideAdminBootstrap(base({ password: VALID_PASSWORD }));
  assert.equal(passwordOnly.action, "error");
});

test("production rejects an invalid email or a too-short password", () => {
  assert.equal(decideAdminBootstrap(base({ email: "not-an-email", password: VALID_PASSWORD })).action, "error");
  assert.equal(decideAdminBootstrap(base({ email: VALID_EMAIL, password: "short" })).action, "error");
});

test("production refuses to take over an email owned by a non-administrator", () => {
  const decision = decideAdminBootstrap(
    base({ email: VALID_EMAIL, password: VALID_PASSWORD, emailTakenByNonAdmin: true }),
  );
  assert.equal(decision.action, "error");
});

test("non-production without credentials falls back to documented development credentials", () => {
  const decision = decideAdminBootstrap(base({ environment: "development" }));
  assert.deepEqual(decision, {
    action: "create",
    email: DEVELOPMENT_FALLBACK_ADMIN_EMAIL,
    password: DEVELOPMENT_FALLBACK_ADMIN_PASSWORD,
    name: "RANG Development Admin",
    source: "development-fallback",
  });
});

test("the development fallback is never selected in production", () => {
  const decision = decideAdminBootstrap(base({ environment: "production" }));
  assert.equal(decision.action, "error");
});

test("development with configured credentials uses those credentials", () => {
  const decision = decideAdminBootstrap(
    base({ environment: "development", email: VALID_EMAIL, password: VALID_PASSWORD }),
  );
  assert.equal(decision.action, "create");
  if (decision.action !== "create") return;
  assert.equal(decision.source, "environment");
  assert.equal(decision.email, VALID_EMAIL);
});

test("configured administrator passwords are hashed with the existing scrypt scheme", async () => {
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/unused";
  const { hashPassword, verifyPassword } = await import("../src/lib/auth.ts");
  const hash = await hashPassword(VALID_PASSWORD);
  assert.notEqual(hash, VALID_PASSWORD);
  assert.match(hash, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword(VALID_PASSWORD, hash), true);
  assert.equal(await verifyPassword("some-other-password", hash), false);
});
