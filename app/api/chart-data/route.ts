import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/chart-data?symbol=RELIANCE.NS&range=1M
 *
 * Proxies Yahoo Finance chart API and returns normalised OHLCV candles.
 * No auth required — mirrors public Yahoo data (delayed ~15m).
 *
 * Query params:
 *   symbol  – Yahoo Finance symbol (e.g. ^NSEI, RELIANCE.NS, GC=F)
 *   range   – UI range: 1D | 1W | 1M | 1Y | ALL
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface RangeSpec {
  yahooRange: string;
  yahooInterval: string;
}

const RANGE_MAP: Record<string, RangeSpec> = {
  "1D": { yahooRange: "1d", yahooInterval: "5m" },
  "1W": { yahooRange: "5d", yahooInterval: "15m" },
  "1M": { yahooRange: "1mo", yahooInterval: "1d" },
  "1Y": { yahooRange: "1y", yahooInterval: "1wk" },
  ALL: { yahooRange: "max", yahooInterval: "1mo" },
};

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") || "^NSEI").trim();
  const rangeKey = (searchParams.get("range") || "1M").toUpperCase();
  const spec = RANGE_MAP[rangeKey] || RANGE_MAP["1M"];

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${spec.yahooRange}&interval=${spec.yahooInterval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: "https://finance.yahoo.com/",
        Origin: "https://finance.yahoo.com",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Yahoo returned ${res.status}`, candles: [] },
        { status: 502 }
      );
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json(
        { error: "No chart data from Yahoo", candles: [] },
        { status: 502 }
      );
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = quote.open ?? [];
    const highs: (number | null)[] = quote.high ?? [];
    const lows: (number | null)[] = quote.low ?? [];
    const closes: (number | null)[] = quote.close ?? [];
    const volumes: (number | null)[] = quote.volume ?? [];

    const candles: Candle[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = opens[i];
      const h = highs[i];
      const l = lows[i];
      const c = closes[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({
        time: timestamps[i],
        open: +o.toFixed(2),
        high: +h.toFixed(2),
        low: +l.toFixed(2),
        close: +c.toFixed(2),
        volume: volumes[i] ?? 0,
      });
    }

    const meta = result.meta ?? {};

    return NextResponse.json({
      symbol,
      range: rangeKey,
      currency: meta.currency ?? "INR",
      exchangeTimezoneName: meta.exchangeTimezoneName ?? "Asia/Kolkata",
      regularMarketPrice: meta.regularMarketPrice ?? null,
      previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
      candles,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to fetch chart: ${msg}`, candles: [] },
      { status: 500 }
    );
  }
}
