import { clerkClient, getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";

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

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.RANG_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function resolveCurrentUser(req: Request): Promise<User | null> {
  const userId = getAuth(req).userId;
  if (!userId) return null;

  const clerkUser = await clerkClient.users.getUser(userId);
  const email = clerkUser.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(
      403,
      "EMAIL_REQUIRED",
      "Add a verified email address to your account to continue.",
    );
  }

  const name =
    clerkUser.fullName?.trim() ||
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
    email;
  const phone = clerkUser.primaryPhoneNumber?.phoneNumber ?? null;
  const grantAdmin = configuredAdminEmails().has(email);
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(usersTable)
      .set({
        email,
        name,
        phone: existing.phone ?? phone,
        ...(grantAdmin ? { role: "admin" } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      email,
      name,
      phone,
      role: grantAdmin ? "admin" : "customer",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const [raced] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.email, email)))
    .limit(1);
  if (!raced) {
    throw new HttpError(409, "ACCOUNT_CONFLICT", "Your account could not be synchronized.");
  }
  return raced;
}

export async function requireUser(
  req: Request,
  res: Response,
  roles?: string[],
): Promise<User | null> {
  const user = await resolveCurrentUser(req);
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

export async function hasStaffAccess(req: Request): Promise<boolean> {
  const user = await resolveCurrentUser(req);
  return user !== null && (user.role === "admin" || user.role === "staff");
}

