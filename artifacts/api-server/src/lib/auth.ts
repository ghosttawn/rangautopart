import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Request, Response } from "express";
import {
  authSessionsTable,
  db,
  passwordResetTokensTable,
  usersTable,
  type User,
} from "@workspace/db";

const AUTH_COOKIE = "rang_auth_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_THRESHOLD_MS = SESSION_TTL_MS / 2;
const CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
let lastCleanupAt = 0;

function deriveKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    );
  });
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, 64);
  return `scrypt$32768$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null,
): Promise<boolean> {
  if (!encoded) return false;
  const [algorithm, n, r, p, saltText, keyText] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "1" ||
    !saltText ||
    !keyText
  ) {
    return false;
  }
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await deriveKey(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/",
  });
}

export function getAuthCookieToken(req: Request): string | null {
  const token = req.cookies?.[AUTH_COOKIE];
  if (typeof token === "string" && /^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return token;
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (/^[A-Za-z0-9_-]{40,100}$/.test(bearer)) {
      return bearer;
    }
  }
  return null;
}

export async function createAuthSession(
  res: Response,
  userId: string,
): Promise<Date> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(authSessionsTable).values({
    userId,
    tokenHash: hashOpaqueToken(token),
    expiresAt,
  });
  setAuthCookie(res, token);
  return expiresAt;
}

export async function revokeAuthSession(req: Request): Promise<void> {
  const token = getAuthCookieToken(req);
  if (!token) return;
  await db
    .delete(authSessionsTable)
    .where(eq(authSessionsTable.tokenHash, hashOpaqueToken(token)));
}

export async function revokeUserSessions(userId: string): Promise<void> {
  await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
}

export async function findAuthSession(
  req: Request,
  res?: Response,
): Promise<{ user: User; expiresAt: Date } | null> {
  const token = getAuthCookieToken(req);
  if (!token) return null;
  const now = new Date();
  const tokenHash = hashOpaqueToken(token);
  const [session] = await db
    .select({
      user: usersTable,
      sessionId: authSessionsTable.id,
      expiresAt: authSessionsTable.expiresAt,
    })
    .from(authSessionsTable)
    .innerJoin(usersTable, eq(authSessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(authSessionsTable.tokenHash, tokenHash),
        gt(authSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);
  if (!session) {
    if (res && token) clearAuthCookie(res);
    return null;
  }

  if (session.expiresAt.getTime() - now.getTime() < SESSION_REFRESH_THRESHOLD_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(authSessionsTable)
      .set({ expiresAt })
      .where(eq(authSessionsTable.id, session.sessionId));
    if (res) setAuthCookie(res, token);
    return { user: session.user, expiresAt };
  }
  return { user: session.user, expiresAt: session.expiresAt };
}

export async function clearExpiredAuthRecords(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  const now = new Date();
  await Promise.all([
    db.delete(authSessionsTable).where(lt(authSessionsTable.expiresAt, now)),
    db
      .delete(passwordResetTokensTable)
      .where(lt(passwordResetTokensTable.expiresAt, now)),
  ]);
  lastCleanupAt = nowMs;
}
