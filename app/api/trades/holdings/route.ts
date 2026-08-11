import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getHoldings } from "@/lib/trades";

/**
 * GET /api/trades/holdings — user's delivery holdings with live P&L.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      holdings: [],
      summary: {
        totalInvested: 0,
        totalCurrent: 0,
        totalPnl: 0,
        totalPnlPct: 0,
        count: 0,
      },
    });
  } catch (err: any) {
    console.error("[trades/holdings]", err);
    return NextResponse.json(
      { message: err.message || "Failed to load holdings" },
      { status: 500 },
    );
  }
}
