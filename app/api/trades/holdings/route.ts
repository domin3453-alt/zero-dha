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

    const holdings = await getHoldings(user._id.toString());

    const totalInvested = holdings.reduce((s, h) => s + h.investedValue, 0);
    const totalCurrent = holdings.reduce((s, h) => s + h.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return NextResponse.json({
      holdings: holdings.map((h) => ({
        id: h._id?.toString(),
        symbol: h.symbol,
        exchange: h.exchange,
        qty: h.qty,
        avgPrice: h.avgPrice,
        ltp: h.ltp,
        pnl: h.pnl,
        pnlPct: h.pnlPct,
        currentValue: h.currentValue,
        investedValue: h.investedValue,
      })),
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPct,
        count: holdings.length,
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
