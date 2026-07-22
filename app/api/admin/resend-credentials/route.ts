import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { sendClientCredentialsEmail } from "@/lib/mailer";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body || {};

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    console.log("[resend-credentials] start", {
      userId,
      smtpUserPresent: !!process.env.SMTP_USER,
      smtpPassPresent: !!process.env.SMTP_PASS,
      smtpUser: process.env.SMTP_USER,
    });

    const db = await getDb();
    const user = await db.collection("users").findOne<{
      email?: string;
      clientId?: string;
      fullName?: string;
      adminPlainPassword?: string;
    }>({ _id: new ObjectId(userId) });

    if (!user) {
      console.warn("[resend-credentials] user not found", { userId });
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    console.log("[resend-credentials] user loaded", {
      userId,
      hasEmail: !!user.email,
      hasClientId: !!user.clientId,
      hasPlainPassword: !!user.adminPlainPassword,
    });

    if (!user.clientId || !user.adminPlainPassword) {
      return NextResponse.json(
        { message: "User does not have credentials set yet" },
        { status: 400 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { message: "User has no email address on file" },
        { status: 400 },
      );
    }

    try {
      await sendClientCredentialsEmail({
        to: user.email,
        fullName: user.fullName,
        clientId: user.clientId,
        password: user.adminPlainPassword,
      });
      console.log("[resend-credentials] email sent", { to: user.email });
    } catch (mailError) {
      const errAny = mailError as {
        message?: string;
        code?: string;
        command?: string;
        response?: string;
        responseCode?: number;
        stack?: string;
      };
      console.error("[resend-credentials] SMTP error", {
        message: errAny?.message,
        code: errAny?.code,
        command: errAny?.command,
        response: errAny?.response,
        responseCode: errAny?.responseCode,
        stack: errAny?.stack,
      });
      return NextResponse.json(
        {
          message: `SMTP error: ${errAny?.message || "unknown"}`,
          code: errAny?.code || null,
          response: errAny?.response || null,
          responseCode: errAny?.responseCode || null,
          smtpUserConfigured: !!process.env.SMTP_USER,
          smtpPassConfigured: !!process.env.SMTP_PASS,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: "Credentials email resent",
      email: user.email,
    });
  } catch (error) {
    const errAny = error as { message?: string; stack?: string; name?: string };
    console.error("[resend-credentials] unhandled error", {
      name: errAny?.name,
      message: errAny?.message,
      stack: errAny?.stack,
    });
    return NextResponse.json(
      {
        message: `Failed to resend credentials: ${errAny?.message || "unknown"}`,
        name: errAny?.name || null,
      },
      { status: 500 },
    );
  }
}
