/**
 * Pure policy for the initial-administrator bootstrap. This module has no
 * database or network imports so it can be unit tested in isolation.
 */

export const ADMIN_EMAIL_ENV = "ADMIN_EMAIL";
export const ADMIN_PASSWORD_ENV = "ADMIN_PASSWORD";
export const ADMIN_ROLE = "admin";

// Documented, development-only fallback credentials. They are never used when
// NODE_ENV is "production"; production requires the environment variables.
export const DEVELOPMENT_FALLBACK_ADMIN_EMAIL = "admin@rang-auto-parts.test";
export const DEVELOPMENT_FALLBACK_ADMIN_PASSWORD = "rang-development-admin";
export const DEVELOPMENT_FALLBACK_ADMIN_NAME = "RANG Development Admin";
export const PRODUCTION_ADMIN_NAME = "RANG Administrator";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

export type AdminBootstrapDecision =
  | { action: "skip"; reason: string }
  | {
      action: "create";
      email: string;
      password: string;
      name: string;
      source: "environment" | "development-fallback";
    }
  | { action: "error"; message: string };

export interface AdminBootstrapInput {
  environment: string | undefined;
  email: string | undefined;
  password: string | undefined;
  /** Number of accounts that already hold the administrator role. */
  existingAdminCount: number;
  /** True when the configured email already belongs to a non-administrator. */
  emailTakenByNonAdmin: boolean;
}

/**
 * Decides what the bootstrap should do from the current environment and
 * database state. Every branch is deliberately explicit so the behavior is
 * predictable and testable.
 */
export function decideAdminBootstrap(input: AdminBootstrapInput): AdminBootstrapDecision {
  if (input.existingAdminCount > 0) {
    return {
      action: "skip",
      reason: "An administrator account already exists; it is left unchanged.",
    };
  }

  const isProduction = input.environment === "production";
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";
  const emailConfigured = email.length > 0;
  const passwordConfigured = password.length > 0;

  if (emailConfigured || passwordConfigured) {
    if (!emailConfigured || !passwordConfigured) {
      return {
        action: "error",
        message: `Set both ${ADMIN_EMAIL_ENV} and ${ADMIN_PASSWORD_ENV} together to create the initial administrator, or leave both unset.`,
      };
    }
    if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
      return {
        action: "error",
        message: `${ADMIN_EMAIL_ENV} must be a valid email address of at most ${EMAIL_MAX_LENGTH} characters.`,
      };
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      return {
        action: "error",
        message: `${ADMIN_PASSWORD_ENV} must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
      };
    }
    if (input.emailTakenByNonAdmin) {
      return {
        action: "error",
        message: `The ${ADMIN_EMAIL_ENV} address already belongs to a non-administrator account. Choose a different administrator email or resolve the existing account before deploying.`,
      };
    }
    return {
      action: "create",
      email,
      password,
      name: PRODUCTION_ADMIN_NAME,
      source: "environment",
    };
  }

  if (isProduction) {
    return {
      action: "error",
      message:
        `No administrator account exists and ${ADMIN_EMAIL_ENV} / ${ADMIN_PASSWORD_ENV} are not set. ` +
        `Add both variables to the Render API service environment (Environment tab) so the initial administrator is created automatically, then redeploy.`,
    };
  }

  return {
    action: "create",
    email: DEVELOPMENT_FALLBACK_ADMIN_EMAIL,
    password: DEVELOPMENT_FALLBACK_ADMIN_PASSWORD,
    name: DEVELOPMENT_FALLBACK_ADMIN_NAME,
    source: "development-fallback",
  };
}
