import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, email, password } = body || {};

    const loginId = (clientId ?? email ?? "").toString().trim();
    if (!loginId || !password) {
      return NextResponse.json(
        { message: "Client ID and password are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ passwordHash?: string; status?: string }>(
      clientId
        ? { clientId: loginId }
        : {
            $or: [{ clientId: loginId }, { email: loginId }],
          },
    );

    if (!user || user.status !== "active" || !user.passwordHash) {
      return NextResponse.json(
        { message: "Invalid credentials or account not activated yet" },
        { status: 401 },
      );
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { message: "Invalid credentials or account not activated yet" },
        { status: 401 },
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const sessions = db.collection("sessions");
    const now = Date.now();
    const ttlMs = 10 * 365 * 24 * 60 * 60 * 1000;

    await sessions.insertOne({
      userId: new ObjectId((user as { _id: ObjectId })._id),
      tokenHash,
      createdAt: new Date(now),
      expiresAt: new Date(now + ttlMs),
    });

    const response = NextResponse.json({
      message: "Login successful",
      token,
    });

    response.cookies.set("ajx_session", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: Math.floor(ttlMs / 1000),
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Something went wrong while logging in" },
      { status: 500 },
    );
  }
}

