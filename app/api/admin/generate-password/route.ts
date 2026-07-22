import { apiErrorResponse } from "@/lib/api-error";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { sendClientCredentialsEmail } from "@/lib/mailer";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { userId, password, clientId } = body || {};

    if (!userId) {
      return NextResponse.json(
        { message: "userId is required" },
        { status: 400 },
      );
    }

    const plainPassword = (password ?? "").toString();
    if (!plainPassword) {
      return NextResponse.json(
        { message: "password is required" },
        { status: 400 },
      );
    }

    const requestedClientId = (clientId ?? "").toString().trim();

    const db = await getDb();
    const users = db.collection("users");

    const user = await users.findOne<{ email?: string; status?: string; clientId?: string; fullName?: string }>({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const existingClientId = (user.clientId ?? "").toString().trim();
    const finalClientId = requestedClientId || existingClientId;
    if (!finalClientId) {
      return NextResponse.json(
        { message: "clientId is required for this user" },
        { status: 400 },
      );
    }

    // if changing/setting clientId, ensure uniqueness
    if (finalClientId !== existingClientId) {
      const dup = await users.findOne({ clientId: finalClientId });
      if (dup) {
        return NextResponse.json(
          { message: "Client ID already exists" },
          { status: 409 },
        );
      }
    }

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          passwordHash,
          adminPlainPassword: plainPassword,
          clientId: finalClientId,
          status: "active",
          activatedAt: new Date(),
        },
      },
    );

    let emailSent = false;
    let emailWarning: string | null = null;

    if (user.email) {
      try {
        await sendClientCredentialsEmail({
          to: user.email,
          fullName: user.fullName,
          clientId: finalClientId,
          password: plainPassword,
        });
        emailSent = true;
      } catch (mailError) {
        console.error("Credentials email error:", mailError);
        emailWarning = "Credentials were saved, but email delivery failed.";
      }
    } else {
      emailWarning = "Credentials were saved, but the user has no email address.";
    }

    return NextResponse.json({
      message: emailSent
        ? "Password set and credentials emailed"
        : "Password set",
      email: user.email,
      clientId: finalClientId,
      emailSent,
      emailWarning,
    });
  } catch (error) {
    return apiErrorResponse(error, "Generate password error:", "Failed to set password");
  }
}
