import { apiErrorResponse } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

async function getAdminPin(): Promise<string | null> {
  try {
    const db = await getDb();
    const doc = await db.collection("settings").findOne({ key: "admin_pin", userId: null });
    if (doc?.value?.pin) return doc.value.pin as string;
  } catch {}
  return process.env.ADMIN_PIN || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body || {};

    if (!pin) {
      return NextResponse.json(
        { message: "PIN is required" },
        { status: 400 },
      );
    }

    const adminPin = await getAdminPin();
    if (!adminPin) {
      console.error("ADMIN_PIN is not set in environment or database");
      return NextResponse.json(
        { message: "Admin PIN is not configured on server" },
        { status: 500 },
      );
    }

    if (pin !== adminPin) {
      return NextResponse.json(
        { message: "Invalid admin PIN" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ message: "Admin authenticated" });
    response.cookies.set("ajx_admin", "ok", {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 2 * 60 * 60, // 2 hours
      path: "/",
    });

    return response;
  } catch (error) {
    return apiErrorResponse(
      error,
      "Admin login error:",
      "Something went wrong while authenticating admin",
    );
  }
}

