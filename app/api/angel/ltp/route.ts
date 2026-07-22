import { NextRequest, NextResponse } from "next/server";
import { angelPost } from "@/lib/angelone/session";
import { INDEX_TOKENS, resolveTradable } from "@/lib/angelone/instruments";

/**
 * GET /api/angel/ltp?symbol=RELIANCE&exchange=NSE
 * POST /api/angel/ltp  body: { tokens: [{ exchange: "NSE", symbol: "RELIANCE" }] }
 *
 * Returns LTP + OHLC quote for one or more symbols.
 */

async function resolveToken(
  exchange: string,
  symbol: string,
): Promise<{ token: string; exchange: string } | null> {
  const idx = INDEX_TOKENS[symbol.toUpperCase()];
  if (idx) return { token: idx.token, exchange: idx.exchange };

  const inst = await resolveTradable(exchange, symbol);
  return inst ? { token: inst.token, exchange: inst.exch_seg } : null;
}

async function fetchQuote(
  exchangeTokens: Record<string, string[]>,
  mode: "LTP" | "OHLC" | "FULL" = "FULL",
) {
  return angelPost("/rest/secure/angelbroking/market/v1/quote/", {
    mode,
    exchangeTokens,
  });
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const symbol = sp.get("symbol") || "NIFTY";
    const exchange = sp.get("exchange") || "NSE";
    const mode = (sp.get("mode") || "FULL") as "LTP" | "OHLC" | "FULL";

    const resolved = await resolveToken(exchange, symbol);
    if (!resolved) {
      return NextResponse.json(
        { error: `Symbol not found: ${exchange}:${symbol}` },
        { status: 404 },
      );
    }

    const result = await fetchQuote(
      { [resolved.exchange]: [resolved.token] },
      mode,
    );
    if (!result.status || !result.data) {
      return NextResponse.json(
        { error: result.message || "Quote fetch failed" },
        { status: 502 },
      );
    }

    const fetched = result.data.fetched || result.data;
    return NextResponse.json({
      symbol,
      exchange,
      data: Array.isArray(fetched) ? fetched[0] : fetched,
    });
  } catch (err: any) {
    console.error("[angel/ltp]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens, mode = "FULL" } = body as {
      tokens: { exchange: string; symbol: string }[];
      mode?: "LTP" | "OHLC" | "FULL";
    };

    if (!tokens?.length) {
      return NextResponse.json(
        { error: "tokens array required" },
        { status: 400 },
      );
    }

    // Group by exchange
    const exchangeTokens: Record<string, string[]> = {};
    const symbolMap = new Map<string, string>(); // token → symbol

    for (const t of tokens) {
      const resolved = await resolveToken(t.exchange, t.symbol);
      if (!resolved) continue;
      if (!exchangeTokens[resolved.exchange]) exchangeTokens[resolved.exchange] = [];
      exchangeTokens[resolved.exchange].push(resolved.token);
      symbolMap.set(resolved.token, t.symbol);
    }

    const result = await fetchQuote(exchangeTokens, mode);
    if (!result.status || !result.data) {
      return NextResponse.json(
        { error: result.message || "Batch quote failed" },
        { status: 502 },
      );
    }

    const fetched = result.data.fetched || result.data;
    return NextResponse.json({ data: fetched });
  } catch (err: any) {
    console.error("[angel/ltp POST]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}
