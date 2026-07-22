import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getPositions } from "@/lib/trades";
import { getEffectiveOrdersConfigForUser } from "@/lib/effective-orders-config";
import { computeOrderPnl } from "@/lib/admin-orders-pnl";

/** Parse strike from option symbol like NIFTY25APR202524000CE */
function parseStrikeFromSymbol(symbol?: string): number | undefined {
  if (!symbol) return undefined;
  const m = String(symbol).match(/(\d+)(CE|PE)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveStrike(r: { strikePrice?: number; symbol?: string }): number | undefined {
  const s = Number(r.strikePrice);
  if (Number.isFinite(s) && s > 0) return s;
  return parseStrikeFromSymbol(r.symbol);
}

/** Avg = avgPrice || buyPrice || buyAt */
function resolveAvg(r: {
  avgPrice?: number;
  buyPrice?: number;
  buyAt?: number;
}): number {
  return Number(r.avgPrice || r.buyPrice || r.buyAt || 0);
}

/**
 * LTP prefers explicit ltp; if stuck equal to avg while sell differs, use sell.
 */
function resolveLtp(
  r: { ltp?: number; sellPrice?: number; sellAt?: number },
  avg: number,
): number {
  const ltp = Number(r.ltp || 0);
  const sell = Number(r.sellPrice || r.sellAt || 0);
  if (sell > 0 && (ltp <= 0 || (avg > 0 && ltp === avg && sell !== avg))) {
    return sell;
  }
  return ltp || sell || avg || 0;
}

/**
 * GET /api/trades/positions
 * Returns admin-configured position rows for this user when they exist,
 * otherwise falls back to real DB positions with live LTP.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = user._id.toString();

    const effectiveConfig = await getEffectiveOrdersConfigForUser(userId);
    const allAdminPositions = (effectiveConfig.orders ?? []).filter(
      (r) => r.segmentKey === "positions",
    );

    if (allAdminPositions.length > 0) {
      function mapPosition(r: (typeof allAdminPositions)[number]) {
        const pnl = computeOrderPnl(r);
        const qty = Number(r.qty || 0);
        const avgPrice = resolveAvg(r);
        const ltp = resolveLtp(r, avgPrice);
        const buyAt = Number(r.buyAt || r.buyPrice || avgPrice || 0);
        const sellAt = Number(r.sellAt || r.sellPrice || 0);
        const investedValue = avgPrice * qty;
        const currentValue = ltp * qty;
        const pnlPct =
          r.pnlPct != null
            ? Number(r.pnlPct)
            : investedValue > 0
              ? (pnl / investedValue) * 100
              : 0;
        return {
          id: r.id,
          symbol: r.symbol,
          exchange: r.exchange || r.market || "NSE",
          side: r.side,
          qty,
          avgPrice,
          ltp,
          buyPrice: Number(r.buyPrice || avgPrice || 0),
          sellPrice: Number(r.sellPrice || sellAt || 0),
          buyAt: buyAt > 0 ? buyAt : undefined,
          sellAt: sellAt > 0 ? sellAt : undefined,
          pnl,
          pnlPct,
          currentValue,
          investedValue,
          productType: r.productType,
          optionType: r.optionType,
          strikePrice: resolveStrike(r),
          expiry: r.expiryDate || undefined,
          showStrike: r.showStrike,
          showOptionType: r.showOptionType,
          showSide: r.showSide,
        };
      }

      const openPositions = allAdminPositions
        .filter((r) => r.status !== "CLOSED")
        .map(mapPosition);

      const allMapped = allAdminPositions.map(mapPosition);
      const totalInvested = openPositions.reduce((s, p) => s + p.investedValue, 0);
      const totalCurrent = openPositions.reduce((s, p) => s + p.currentValue, 0);
      const totalPnl = allMapped.reduce((s, p) => s + p.pnl, 0);
      const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      return NextResponse.json({
        positions: openPositions,
        summary: {
          totalInvested,
          totalCurrent,
          totalPnl,
          totalPnlPct,
          count: openPositions.length,
        },
      });
    }

    const positions = await getPositions(userId);
    const totalInvested = positions.reduce((s, p) => s + p.investedValue, 0);
    const totalCurrent = positions.reduce((s, p) => s + p.currentValue, 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return NextResponse.json({
      positions: positions.map((p) => ({
        id: p._id?.toString(),
        symbol: p.symbol,
        exchange: p.exchange,
        side: p.side,
        qty: p.qty,
        avgPrice: p.avgPrice,
        ltp: p.ltp,
        pnl: p.pnl,
        pnlPct: p.pnlPct,
        currentValue: p.currentValue,
        investedValue: p.investedValue,
        productType: p.productType,
        optionType: p.optionType,
        strikePrice: p.strikePrice || parseStrikeFromSymbol(p.symbol),
        expiry: p.expiry,
      })),
      summary: {
        totalInvested,
        totalCurrent,
        totalPnl,
        totalPnlPct,
        count: positions.length,
      },
    });
  } catch (err: any) {
    console.error("[trades/positions]", err);
    return NextResponse.json(
      { message: err.message || "Failed to load positions" },
      { status: 500 },
    );
  }
}
