import { apiErrorResponse } from "@/lib/api-error";
import { getDb } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const fullName = (body?.fullName ?? "").toString().trim();
    const clientId = (body?.clientId ?? "").toString().trim();
    const password = (body?.password ?? "").toString();

    if (!fullName || !clientId || !password) {
      return NextResponse.json(
        { message: "fullName, clientId and password are required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ clientId });
    if (existing) {
      return NextResponse.json(
        { message: "clientId already exists" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await users.insertOne({
      fullName,
      clientId,
      email: `${clientId}@client.local`,
      phone: "",
      status: "active",
      createdAt: new Date(),
      activatedAt: new Date(),
      passwordHash,
      adminPlainPassword: password,
      tradingBalance: 0,
      margin: 0,
    });

    return NextResponse.json({ message: "Client created", clientId });
  } catch (error) {
    return apiErrorResponse(error, "Create client error:", "Failed to create client");
  }
}
