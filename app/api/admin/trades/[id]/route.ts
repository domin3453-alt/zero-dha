import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("ajx_admin");
  return !!adminCookie && adminCookie.value === "ok";
}

/** PATCH /api/admin/trades/[id]  — update any field on a trade */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid trade ID" }, { status: 400 });
    }

    const body = await request.json();
    // Strip immutable fields
    const { _id, userId, createdAt, executedAt, ...updates } = body;

    // Coerce numeric fields
    if (updates.qty !== undefined) updates.qty = Number(updates.qty);
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.totalValue !== undefined) updates.totalValue = Number(updates.totalValue);
    if (updates.pnl !== undefined) updates.pnl = Number(updates.pnl);
    if (updates.strikePrice !== undefined)
      updates.strikePrice = updates.strikePrice ? Number(updates.strikePrice) : undefined;
    if (updates.limitPrice !== undefined)
      updates.limitPrice = updates.limitPrice ? Number(updates.limitPrice) : undefined;

    const db = await getDb();
    const result = await db.collection("trades").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ message: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ trade: result });
  } catch (error: any) {
    console.error("[admin/trades/[id] PATCH]", error);
    return NextResponse.json(
      { message: error?.message || "Update failed" },
      { status: 500 },
    );
  }
}

/** DELETE /api/admin/trades/[id]  — remove a trade record */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ok = await requireAdmin();
    if (!ok) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid trade ID" }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection("trades").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Trade deleted" });
  } catch (error: any) {
    console.error("[admin/trades/[id] DELETE]", error);
    return NextResponse.json(
      { message: error?.message || "Delete failed" },
      { status: 500 },
    );
  }
}
