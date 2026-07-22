import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  getEffectiveOrdersConfigForUser,
  type OrderRowEffective,
} from "@/lib/effective-orders-config";

function computePnl(o: OrderRowEffective) {
  if (o.pnlManual && typeof o.pnl === "number" && Number.isFinite(o.pnl)) {
    return o.pnl;
  }

  const lots = Number(o.lots ?? o.qty ?? 0);
  const buy = Number(o.buyPrice ?? o.avgPrice ?? 0);
  const sell = Number(o.sellPrice ?? o.ltp ?? 0);

  if (o.side === "SELL") {
    return (buy - sell) * lots;
  }
  return (sell - buy) * lots;
}

function parseStrikeFromSymbol(symbol?: string): number | undefined {
  if (!symbol) return undefined;
  const m = String(symbol).match(/(\d+)(CE|PE)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function resolveStrike(o: OrderRowEffective): number | undefined {
  const s = Number(o.strikePrice);
  if (Number.isFinite(s) && s > 0) return s;
  return parseStrikeFromSymbol(o.symbol);
}

function resolveLtp(
  o: OrderRowEffective,
  avg: number,
): number {
  const ltp = Number(o.ltp || 0);
  const sell = Number(o.sellPrice || o.sellAt || 0);
  if (sell > 0 && (ltp <= 0 || (avg > 0 && ltp === avg && sell !== avg))) {
    return sell;
  }
  return ltp || sell || avg || 0;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const userId = (user as { _id?: { toString(): string } } | null)?._id?.toString();

    const config = await getEffectiveOrdersConfigForUser(userId);

    const rawOrders: OrderRowEffective[] = Array.isArray(config.orders)
      ? config.orders
      : [];

    const orders = rawOrders.map((o: OrderRowEffective) => {
      const avgPrice = Number(o.avgPrice || o.buyPrice || o.buyAt || 0);
      let entryPrice = Number(o.buyAt || o.buyPrice || avgPrice || 0);
      let exitPrice = Number(o.sellAt || o.sellPrice || o.ltp || 0);
      // Always provide both for history / display chips
      if (!(entryPrice > 0) && exitPrice > 0) entryPrice = exitPrice;
      if (!(exitPrice > 0) && entryPrice > 0) exitPrice = entryPrice;
      const ltp = resolveLtp(o, avgPrice) || exitPrice || entryPrice;
      return {
        ...o,
        avgPrice: avgPrice || entryPrice,
        ltp,
        buyPrice: Number(o.buyPrice || entryPrice || 0),
        sellPrice: Number(o.sellPrice || exitPrice || 0),
        buyAt: entryPrice,
        sellAt: exitPrice,
        strikePrice: resolveStrike(o),
      };
    });

    const derivedSummary = {
      dayPnl: rawOrders.reduce((a, o) => a + computePnl(o), 0),
      totalPnl: rawOrders.reduce((a, o) => a + computePnl(o), 0),
    };

    return NextResponse.json({
      config: {
        ...config,
        orders,
        summary: derivedSummary,
        segments: Array.isArray(config.segments) ? config.segments : [],
      },
    });
  } catch (error) {
    console.error("Config orders error:", error);
    return NextResponse.json(
      { message: "Failed to load orders" },
      { status: 500 },
    );
  }
}
