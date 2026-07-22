import { cookies } from "next/headers";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";

export const SESSION_COOKIE_NAME = "ajx_session";
const SESSION_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: ObjectId) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const now = Date.now();

  const db = await getDb();
  const sessions = db.collection("sessions");

  await sessions.insertOne({
    userId,
    tokenHash,
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_TTL_MS),
  });

  const response = new Response(null, { status: 204 });
  response.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000,
    )}`,
  );

  return { token, response };
}

/** Resolve user from raw session token (cookie or Authorization Bearer). */
export async function getUserBySessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const db = await getDb();
  const sessions = db.collection("sessions");

  const session = await sessions.findOne<{
    userId: ObjectId;
    expiresAt: Date;
  }>({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    return null;
  }

  const users = db.collection("users");
  return users.findOne({ _id: new ObjectId(session.userId) });
}

export async function getUserFromSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return getUserBySessionToken(sessionCookie?.value);
}

/** App / API routes: prefer `Authorization: Bearer <token>` (mobile), else session cookie (web). */
export async function getUserFromRequest(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return getUserBySessionToken(token);
  }
  return getUserFromSession();
}
