import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/mongodb";

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    let sessionToken: string | undefined;
    if (auth?.startsWith("Bearer ")) {
      sessionToken = auth.slice(7).trim();
    } else {
      const cookieStore = await cookies();
      sessionToken = cookieStore.get("ajx_session")?.value;
    }

    if (sessionToken) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(sessionToken)
        .digest("hex");

      const db = await getDb();
      await db.collection("sessions").deleteOne({ tokenHash });
    }

    const response = NextResponse.json({ message: "Logged out" });
    response.cookies.set("ajx_session", "", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ message: "Failed to logout" }, { status: 500 });
  }
}
