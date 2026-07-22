import { NextRequest, NextResponse } from "next/server";
import { resolveAngelSymbol } from "@/lib/angelone/symbol-map";

/**
 * GET /api/angel/resolve?yahoo=RELIANCE.NS
 *
 * Maps a Yahoo Finance symbol to Angel One symbol + exchange.
 */
export async function GET(request: NextRequest) {
  const yahoo = request.nextUrl.searchParams.get("yahoo") || "";
  if (!yahoo) {
    return NextResponse.json({ error: "yahoo param required" }, { status: 400 });
  }

  const info = resolveAngelSymbol(yahoo);
  return NextResponse.json(info);
}
