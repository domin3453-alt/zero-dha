import { apiErrorResponse } from "@/lib/api-error";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const docs = await users
      .find(
        {},
        {
          projection: {
            fullName: 1,
            clientId: 1,
            email: 1,
            phone: 1,
            panNumber: 1,
            aadhaarNumber: 1,
            status: 1,
            adminPlainPassword: 1,
            tradingBalance: 1,
            margin: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ users: docs });
  } catch (error) {
    return apiErrorResponse(error, "Admin users list error:", "Failed to fetch users");
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, tradingBalance, margin, status, clientId, email } = body || {};

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof clientId === "string") {
      const normalized = clientId.trim();
      if (!normalized) {
        return NextResponse.json(
          { message: "clientId cannot be empty" },
          { status: 400 },
        );
      }

      const existing = await users.findOne({
        clientId: normalized,
        _id: { $ne: new ObjectId(userId) },
      });
      if (existing) {
        return NextResponse.json(
          { message: "clientId already exists" },
          { status: 400 },
        );
      }

      updates.clientId = normalized;
    }
    if (typeof email === "string") {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return NextResponse.json(
          { message: "email cannot be empty" },
          { status: 400 },
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json(
          { message: "Enter a valid email address" },
          { status: 400 },
        );
      }
      const existingEmail = await users.findOne({
        email: normalizedEmail,
        _id: { $ne: new ObjectId(userId) },
      });
      if (existingEmail) {
        return NextResponse.json(
          { message: "Email already in use by another user" },
          { status: 400 },
        );
      }
      updates.email = normalizedEmail;
    }
    if (typeof tradingBalance === "number" && Number.isFinite(tradingBalance)) {
      updates.tradingBalance = tradingBalance;
    }
    if (typeof margin === "number" && Number.isFinite(margin)) {
      updates.margin = margin;
    }
    if (status && ["pending", "active", "blocked"].includes(status)) {
      updates.status = status;
    }

    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: updates,
      },
    );

    return NextResponse.json({ message: "User updated" });
  } catch (error) {
    return apiErrorResponse(error, "Admin users update error:", "Failed to update user");
  }
}

