import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getTradeHistory } from "@/lib/trades";
import { getEffectiveOrdersConfigForUser } from "@/lib/effective-orders-config";

function parseStrikeFromSymbol(symbol?: string): number | undefined {
  if (!symbol) return undefined;
  const m = String(symbol).match(/(\d+)(CE|PE)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Always return both buy & sell prices for history display. */
function bothPrices(buy: number, sell: number, fallback = 0) {
  let buyAt = buy > 0 ? buy : 0;
  let sellAt = sell > 0 ? sell : 0;
  if (!(buyAt > 0) && sellAt > 0) buyAt = sellAt;
  if (!(sellAt > 0) && buyAt > 0) sellAt = buyAt;
  if (!(buyAt > 0) && !(sellAt > 0) && fallback > 0) {
    buyAt = fallback;
    sellAt = fallback;
  }
  return { buyAt, sellAt };
}

/**
 * GET /api/trades/orders — user's trade history.
 * Merges real executed trades from MongoDB with CLOSED admin-configured positions.
 * Every history row always includes both buyAt and sellAt.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = user._id.toString();
    const limit = Number(request.nextUrl.searchParams.get("limit")) || 50;

    const [trades, effectiveConfig] = await Promise.all([
      getTradeHistory(userId, limit),
      getEffectiveOrdersConfigForUser(userId),
    ]);

    const realTrades = trades.map((t) => {
      const price = Number(t.price || 0);
      // Prefer side-specific field, but always fill both for history UI
      const buyRaw = t.side === "BUY" ? price : Number((t as { buyPrice?: number }).buyPrice || 0);
      const sellRaw =
        t.side === "SELL" ? price : Number((t as { sellPrice?: number }).sellPrice || 0);
      const { buyAt, sellAt } = bothPrices(
        buyRaw || (t.side === "BUY" ? price : 0),
        sellRaw || (t.side === "SELL" ? price : 0),
        price,
      );
      return {
        id: t._id?.toString(),
        symbol: t.symbol,
        exchange: t.exchange,
        side: t.side,
        qty: t.qty,
        ltp: price || sellAt || buyAt,
        avgPrice: buyAt || price,
        buyPrice: buyAt,
        sellPrice: sellAt,
        buyAt,
        sellAt,
        orderType: t.orderType,
        status: t.status,
        productType: t.productType,
        totalValue: t.totalValue,
        pnl: t.pnl,
        optionType: t.optionType,
        strikePrice: t.strikePrice || parseStrikeFromSymbol(t.symbol),
        expiry: t.expiry,
        createdAt: t.createdAt,
        executedAt: t.executedAt,
        source: "trade" as const,
      };
    });

    const adminHistoryRows = (effectiveConfig.orders ?? [])
      .filter((r) => r.status === "CLOSED" || r.segmentKey === "history")
      .map((r) => {
        const buyRaw = Number(r.buyAt || r.buyPrice || r.avgPrice || 0);
        // Never fall back to LTP for sell — keeps LTP and Sell independent
        const sellRaw = Number(r.sellAt || r.sellPrice || 0);
        const qty = Number(r.qty || 0);
        const { buyAt, sellAt } = bothPrices(buyRaw, sellRaw, 0);
        const avgPrice = Number(r.avgPrice || buyAt || 0);
        const ltpVal = Number(r.ltp || 0);
        const ltp = ltpVal > 0 ? ltpVal : 0;
        const pnl = r.pnlManual
          ? Number(r.pnl || 0)
          : (sellAt - buyAt) * qty;
        return {
          id: r.id,
          symbol: r.symbol,
          exchange: r.exchange || "NSE",
          side: (r.side?.toUpperCase() as "BUY" | "SELL") || "BUY",
          qty,
          ltp,
          avgPrice,
          buyPrice: buyAt,
          sellPrice: sellAt,
          buyAt,
          sellAt,
          orderType: "MARKET" as const,
          status: "EXECUTED" as const,
          productType: r.productType || "CNC",
          totalValue: (ltp || avgPrice) * qty,
          pnl,
          optionType: r.optionType || undefined,
          strikePrice:
            (r.strikePrice ? Number(r.strikePrice) : undefined) ||
            parseStrikeFromSymbol(r.symbol),
          expiry: r.expiryDate || undefined,
          createdAt: new Date(),
          executedAt: new Date(),
          source: "admin" as const,
          showStrike: r.showStrike,
          showOptionType: r.showOptionType,
          showSide: r.showSide,
        };
      });

    const realTradeIds = new Set(realTrades.map((t) => t.id));
    const dedupedAdmin = adminHistoryRows.filter((r) => !realTradeIds.has(r.id));

    const allOrders = [...realTrades, ...dedupedAdmin].slice(0, limit);

    return NextResponse.json({ orders: allOrders });
  } catch (err: any) {
    console.error("[trades/orders]", err);
    return NextResponse.json(
      { message: err.message || "Failed to load orders" },
      { status: 500 },
    );
  }
}
