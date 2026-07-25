import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/mongodb";

export async function POST(request: Request) {
  const jar = await cookies();
  if (jar.get("ajx_admin")?.value !== "ok") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { newPin } = await request.json();

    if (!newPin || typeof newPin !== "string" || newPin.trim().length < 4) {
      return NextResponse.json(
        { message: "New PIN must be at least 4 characters" },
        { status: 400 },
      );
    }

    const db = await getDb();
    await db.collection("settings").updateOne(
      { key: "admin_pin", userId: null },
      { $set: { value: { pin: newPin.trim() }, updatedAt: new Date() } },
      { upsert: true },
    );

    return NextResponse.json({ message: "Admin PIN updated successfully" });
  } catch (err: any) {
    console.error("[change-pin]", err);
    return NextResponse.json({ message: err.message || "Failed to update PIN" }, { status: 500 });
  }
}
