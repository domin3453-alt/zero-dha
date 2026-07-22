import { NextRequest, NextResponse } from "next/server";
import { loadInstruments } from "@/lib/angelone/instruments";

/**
 * GET /api/angel/debug-instruments?q=PLAT&exchange=MCX&type=FUTCOM
 * Quick scrip-master dump for diagnosing symbol resolution failures.
 * Admin-only in prod — remove or gate after debugging.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") || "").toUpperCase();
  const exchange = (sp.get("exchange") || "").toUpperCase();
  const type = (sp.get("type") || "").toUpperCase();

  const cache = await loadInstruments();

  const results = cache.data
    .filter((i) => {
      if (exchange && i.exch_seg !== exchange) return false;
      if (type && i.instrumenttype !== type) return false;
      if (q) {
        const hay = `${i.symbol} ${i.name}`.toUpperCase();
        return hay.includes(q);
      }
      return true;
    })
    .slice(0, 50)
    .map((i) => ({
      token: i.token,
      symbol: i.symbol,
      name: i.name,
      expiry: i.expiry,
      lotsize: i.lotsize,
      instrumenttype: i.instrumenttype,
      exch_seg: i.exch_seg,
    }));

  return NextResponse.json({ count: results.length, results });
}
