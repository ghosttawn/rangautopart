import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  ChangePasswordBody,
  GetAuthSessionResponse,
  LoginAccountBody,
  LoginAccountResponse,
  RegisterAccountBody,
  RegisterAccountResponse,
  RequestPasswordResetBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import {
  authSessionsTable,
  db,
  passwordResetTokensTable,
  usersTable,
} from "@workspace/db";
import {
  clearExpiredAuthRecords,
  clearAuthCookie,
  createAuthSession,
  findAuthSession,
  hashOpaqueToken,
  hashPassword,
  revokeAuthSession,
  revokeUserSessions,
  verifyPassword,
} from "../lib/auth";
import { findUserByEmail, resolveCurrentUser } from "../middlewares/auth";
import type { User } from "@workspace/db";

const router: IRouter = Router();

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

function errorResponse(error: string, code: string) {
  return { error, code };
}

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

function sessionResponse(user: Parameters<typeof publicUser>[0] | null, expiresAt: Date | null) {
  return GetAuthSessionResponse.parse({
    user: user ? publicUser(user) : null,
    expiresAt,
  });
}

router.get("/auth/session", async (req, res): Promise<void> => {
  const session = await findAuthSession(req, res);
  res
    .setHeader("Cache-Control", "no-store")
    .json(sessionResponse(session?.user ?? null, session?.expiresAt ?? null));
});

router.post("/auth/register", authRateLimit, async (req, res): Promise<void> => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Enter a valid name, email, and password of at least 12 characters.", "INVALID_REGISTRATION"));
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  const existing = await findUserByEmail(email);
  if (existing) {
    res.status(409).json(errorResponse("An account already exists for this email. Sign in or recover your password.", "EMAIL_ALREADY_REGISTERED"));
    return;
  }

  await clearExpiredAuthRecords();
  const passwordHash = await hashPassword(parsed.data.password);
  let user: User | undefined;
  try {
    [user] = await db
      .insert(usersTable)
      .values({
        id: randomUUID(),
        email,
        name,
        role: "customer",
        passwordHash,
      })
      .returning();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json(errorResponse("An account already exists for this email. Sign in or recover your password.", "EMAIL_ALREADY_REGISTERED"));
      return;
    }
    throw error;
  }
  if (!user) throw new Error("Account could not be created.");
  const expiresAt = await createAuthSession(res, user.id);
  res.status(201).json(
    RegisterAccountResponse.parse({
      user: publicUser(user),
      expiresAt,
    }),
  );
});

router.post("/auth/login", authRateLimit, async (req, res): Promise<void> => {
  const parsed = LoginAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Enter a valid email and password.", "INVALID_LOGIN"));
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json(errorResponse("Email or password is incorrect.", "INVALID_CREDENTIALS"));
    return;
  }

  await clearExpiredAuthRecords();
  const expiresAt = await createAuthSession(res, user.id);
  res.json(
    LoginAccountResponse.parse({
      user: publicUser(user),
      expiresAt,
    }),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await revokeAuthSession(req);
  clearAuthCookie(res);
  res.sendStatus(204);
});

router.post("/auth/forgot-password", authRateLimit, async (req, res): Promise<void> => {
  const parsed = RequestPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Enter a valid email address.", "INVALID_EMAIL"));
    return;
  }
  // Reset tokens are deliberately not created until a delivery mechanism is
  // configured. Returning a generic service error avoids pretending that an
  // email was sent or exposing whether an account exists.
  req.log.warn("Password recovery requested while email delivery is not configured");
  res.status(503).json(
    errorResponse(
      "Password recovery email is not configured yet. Contact the RANG parts desk for help.",
      "EMAIL_DELIVERY_UNAVAILABLE",
    ),
  );
});

router.post("/auth/reset-password", authRateLimit, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("This password recovery link is invalid or expired.", "INVALID_RESET_TOKEN"));
    return;
  }
  const tokenHash = hashOpaqueToken(parsed.data.token);
  const now = new Date();
  const [reset] = await db
    .select({ id: passwordResetTokensTable.id, userId: passwordResetTokensTable.userId })
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        gt(passwordResetTokensTable.expiresAt, now),
        sql`${passwordResetTokensTable.consumedAt} IS NULL`,
      ),
    )
    .limit(1);
  if (!reset) {
    res.status(400).json(errorResponse("This password recovery link is invalid or expired.", "INVALID_RESET_TOKEN"));
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const consumed = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(passwordResetTokensTable)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokensTable.id, reset.id),
          gt(passwordResetTokensTable.expiresAt, now),
          sql`${passwordResetTokensTable.consumedAt} IS NULL`,
        ),
      )
      .returning({ id: passwordResetTokensTable.id });
    if (!claimed) return false;
    await tx
      .update(usersTable)
      .set({ passwordHash, updatedAt: now })
      .where(eq(usersTable.id, reset.userId));
    await tx
      .update(passwordResetTokensTable)
      .set({ consumedAt: now })
      .where(
        and(
          eq(passwordResetTokensTable.userId, reset.userId),
          sql`${passwordResetTokensTable.consumedAt} IS NULL`,
        ),
      );
    await tx.delete(authSessionsTable).where(eq(authSessionsTable.userId, reset.userId));
    return true;
  });
  if (!consumed) {
    res.status(400).json(errorResponse("This password recovery link is invalid or expired.", "INVALID_RESET_TOKEN"));
    return;
  }
  res.status(204).send();
});

router.post("/auth/change-password", authRateLimit, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(errorResponse("Enter your current password and a new password of at least 12 characters.", "INVALID_PASSWORD_CHANGE"));
    return;
  }
  const user = await resolveCurrentUser(req, res);
  if (!user) {
    res.status(401).json(errorResponse("Sign in to change your password.", "UNAUTHENTICATED"));
    return;
  }
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    res.status(401).json(errorResponse("Your current password is incorrect.", "CURRENT_PASSWORD_INCORRECT"));
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
  await revokeUserSessions(user.id);
  await createAuthSession(res, user.id);
  res.status(204).send();
});

export default router;
