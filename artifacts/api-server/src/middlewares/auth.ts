import { eq, sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { findAuthSession } from "../lib/auth";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function resolveCurrentUser(
  req: Request,
  res?: Response,
): Promise<User | null> {
  const session = await findAuthSession(req, res);
  return session?.user ?? null;
}

export async function requireUser(
  req: Request,
  res: Response,
  roles?: string[],
): Promise<User | null> {
  const user = await resolveCurrentUser(req, res);
  if (!user) {
    res.status(401).json({
      error: "Sign in to continue.",
      code: "UNAUTHENTICATED",
    });
    return null;
  }

  if (roles && !roles.includes(user.role)) {
    res.status(403).json({
      error: "You do not have permission to access this area.",
      code: "FORBIDDEN",
    });
    return null;
  }
  return user;
}

export async function hasStaffAccess(
  req: Request,
  res?: Response,
): Promise<boolean> {
  const user = await resolveCurrentUser(req, res);
  return user !== null && (user.role === "admin" || user.role === "staff");
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return user ?? null;
}
