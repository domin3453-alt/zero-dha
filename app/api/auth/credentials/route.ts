import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = (body?.currentPassword ?? "").toString();
    const newClientId = (body?.newClientId ?? "").toString().trim();
    const newPassword = (body?.newPassword ?? "").toString();

    if (!currentPassword) {
      return NextResponse.json({ message: "Current password is required" }, { status: 400 });
    }
    if (!newClientId && !newPassword) {
      return NextResponse.json({ message: "Provide a new client ID or a new password" }, { status: 400 });
    }
    if (newPassword && newPassword.length < 6) {
      return NextResponse.json({ message: "New password must be at least 6 characters" }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection("users");
    const userId = new ObjectId((user as { _id: ObjectId })._id);

    const current = await users.findOne<{ passwordHash?: string; clientId?: string }>(
      { _id: userId },
    );
    if (!current?.passwordHash) {
      return NextResponse.json({ message: "Account not properly set up" }, { status: 400 });
    }

    const passwordOk = await bcrypt.compare(currentPassword, current.passwordHash);
    if (!passwordOk) {
      return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (newClientId) {
      if (newClientId === current.clientId) {
        return NextResponse.json({ message: "New client ID is the same as current" }, { status: 400 });
      }
      const existing = await users.findOne({ clientId: newClientId, _id: { $ne: userId } });
      if (existing) {
        return NextResponse.json({ message: "Client ID is already taken" }, { status: 400 });
      }
      updates.clientId = newClientId;
    }

    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      updates.passwordHash = hash;
      updates.adminPlainPassword = newPassword;
    }

    await users.updateOne({ _id: userId }, { $set: updates });

    return NextResponse.json({ message: "Credentials updated successfully" });
  } catch (error) {
    console.error("Credentials update error:", error);
    return NextResponse.json({ message: "Failed to update credentials" }, { status: 500 });
  }
}
