import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

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
    const { requestId } = body || {};

    if (!requestId) {
      return NextResponse.json(
        { message: "requestId is required" },
        { status: 400 },
      );
    }

    const db = await getDb();
    const funds = db.collection("fund_requests");
    const users = db.collection("users");

    const requestDoc = await funds.findOne<{
      _id: ObjectId;
      userId: ObjectId;
      amount: number;
      type?: "add" | "withdraw";
      status: string;
    }>({
      _id: new ObjectId(requestId),
    });

    if (!requestDoc) {
      return NextResponse.json(
        { message: "Fund request not found" },
        { status: 404 },
      );
    }

    if (requestDoc.status !== "pending") {
      return NextResponse.json(
        { message: "Request is not pending" },
        { status: 400 },
      );
    }

    const requestType = requestDoc.type || "add";
    const balanceDelta =
      requestType === "withdraw" ? -Math.abs(requestDoc.amount) : requestDoc.amount;

    await users.updateOne(
      { _id: new ObjectId(requestDoc.userId) },
      {
        $inc: { tradingBalance: balanceDelta },
        $set: { updatedAt: new Date() },
      },
    );

    await funds.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: { status: "approved", processedAt: new Date() },
      },
    );

    return NextResponse.json({
      message:
        requestType === "withdraw"
          ? "Withdrawal approved and balance updated"
          : "Fund approved and balance updated",
    });
  } catch (error) {
    return apiErrorResponse(error, "Admin approve fund error:", "Failed to approve fund");
  }
}
