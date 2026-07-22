import { NextRequest, NextResponse } from "next/server";
import { searchInstruments } from "@/lib/angelone/instruments";

/**
 * GET /api/angel/search?q=RELIANCE&exchange=NSE&limit=20
 *
 * Search instruments by name/symbol.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const q = sp.get("q") || "";
    const exchange = sp.get("exchange") || undefined;
    const limit = Math.min(50, Number(sp.get("limit")) || 20);

    if (q.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 },
      );
    }

    const results = await searchInstruments(q, exchange, limit);

    return NextResponse.json({
      query: q,
      results: results.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        token: r.token,
        exchange: r.exch_seg,
        instrumentType: r.instrumenttype,
        lotSize: r.lotsize,
      })),
    });
  } catch (err: any) {
    console.error("[angel/search]", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 },
    );
  }
}
