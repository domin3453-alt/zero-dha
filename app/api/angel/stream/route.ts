import { NextRequest } from "next/server";
import { angelPost } from "@/lib/angelone/session";

/**
 * GET /api/angel/stream?symbols=NSE:NIFTY,NSE:RELIANCE&interval=2000
 *
 * SSE endpoint — polls Angel LTP at the given interval and streams to the client.
 * Angel WebSocket v2 requires binary protocol; SSE polling is simpler and
 * works reliably through Next.js edge/serverless. Default poll: 2s.
 */

const MIN_INTERVAL = 1000;
const MAX_INTERVAL = 10000;
const DEFAULT_INTERVAL = 2000;

import { INDEX_TOKENS, resolveTradable } from "@/lib/angelone/instruments";

async function resolveToken(
  exchange: string,
  symbol: string,
): Promise<{ token: string; exchange: string } | null> {
  const idx = INDEX_TOKENS[symbol.toUpperCase()];
  if (idx) return { token: idx.token, exchange: idx.exchange };

  const inst = await resolveTradable(exchange, symbol);
  return inst ? { token: inst.token, exchange: inst.exch_seg } : null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const symbolsParam = sp.get("symbols") || "NSE:NIFTY";
  const interval = Math.min(
    MAX_INTERVAL,
    Math.max(MIN_INTERVAL, Number(sp.get("interval")) || DEFAULT_INTERVAL),
  );

  // Parse "NSE:NIFTY,NSE:RELIANCE" into [{exchange,symbol}]
  const pairs = symbolsParam.split(",").map((s) => {
    const [exchange, symbol] = s.trim().split(":");
    return { exchange: exchange || "NSE", symbol: symbol || exchange };
  });

  // Resolve tokens upfront
  const exchangeTokens: Record<string, string[]> = {};
  const tokenSymbolMap = new Map<string, { exchange: string; symbol: string }>();

  for (const p of pairs) {
    const resolved = await resolveToken(p.exchange, p.symbol);
    if (!resolved) continue;
    if (!exchangeTokens[resolved.exchange]) exchangeTokens[resolved.exchange] = [];
    exchangeTokens[resolved.exchange].push(resolved.token);
    tokenSymbolMap.set(resolved.token, p);
  }

  if (!Object.keys(exchangeTokens).length) {
    return new Response("data: {\"error\":\"No valid symbols\"}\n\n", {
      status: 400,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();
  let alive = true;

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        while (alive) {
          try {
            const result = await angelPost(
              "/rest/secure/angelbroking/market/v1/quote/",
              { mode: "FULL", exchangeTokens },
            );

            if (result.status && result.data?.fetched) {
              const ticks = result.data.fetched.map((q: any) => ({
                symbol:
                  tokenSymbolMap.get(q.symbolToken || q.symboltoken)?.symbol ||
                  q.tradingSymbol,
                exchange:
                  tokenSymbolMap.get(q.symbolToken || q.symboltoken)?.exchange ||
                  q.exchange,
                ltp: q.ltp,
                open: q.open,
                high: q.high,
                low: q.low,
                close: q.close,
                volume: q.tradeVolume,
                change: q.netChange,
                changePct: q.percentChange,
                lastTradeTime: q.exchFeedTime,
              }));

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(ticks)}\n\n`),
              );
            }
          } catch (err: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: err.message })}\n\n`,
              ),
            );
          }

          // Wait for interval
          await new Promise((r) => setTimeout(r, interval));
        }
      };

      poll().catch(() => {
        alive = false;
      });
    },
    cancel() {
      alive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
