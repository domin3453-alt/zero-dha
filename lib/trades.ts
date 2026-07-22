/**
 * Paper trading engine — manages orders, positions, and holdings in MongoDB.
 * Uses real Angel One LTP for execution prices.
 */
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import { angelPost } from "./angelone/session";
import { findBySymbol, INDEX_TOKENS, resolveTradable } from "./angelone/instruments";

export interface Trade {
  _id?: ObjectId;
  userId: ObjectId;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  qty: number;
  price: number;           // execution price (LTP at time of order for MARKET)
  limitPrice?: number;     // for LIMIT orders
  status: "EXECUTED" | "PENDING" | "CANCELLED" | "REJECTED";
  productType: "CNC" | "MIS" | "NRML"; // CNC=delivery, MIS=intraday, NRML=F&O
  lotSize: number;
  totalValue: number;      // price * qty
  segmentKey: string;      // "openOrders" | "positions" | "history"
  optionType?: string;     // "CE" | "PE" for options
  strikePrice?: number;
  expiry?: string;
  pnl: number;
  createdAt: Date;
  executedAt?: Date;
}

export interface Position {
  _id?: ObjectId;
  userId: ObjectId;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  qty: number;
  avgPrice: number;
  productType: string;
  lotSize: number;
  optionType?: string;
  strikePrice?: number;
  expiry?: string;
  createdAt: Date;
  updatedAt: Date;
}

async function tradesCol() {
  const db = await getDb();
  return db.collection<Trade>("trades");
}

async function positionsCol() {
  const db = await getDb();
  return db.collection<Position>("positions");
}

/** Resolve current LTP from Angel One. Works for indices, equities, options, MCX futures. */
async function fetchLTP(symbol: string, exchange: string): Promise<number> {
  let token: string | undefined;
  let resolvedExchange = exchange;

  // Indices
  const idx = INDEX_TOKENS[symbol.toUpperCase()];
  if (idx) {
    token = idx.token;
    resolvedExchange = idx.exchange;
  } else {
    // Try direct symbol first (handles full option symbols like NIFTY25APR202524000CE)
    // and MCX → nearest-month future fallback
    const inst = await resolveTradable(exchange, symbol);
    token = inst?.token;
    if (inst) resolvedExchange = inst.exch_seg;
  }

  if (!token) throw new Error(`Cannot resolve token for ${exchange}:${symbol}`);

  const result = await angelPost(
    "/rest/secure/angelbroking/market/v1/quote/",
    { mode: "LTP", exchangeTokens: { [resolvedExchange]: [token] } },
  );

  const ltp = result?.data?.fetched?.[0]?.ltp;
  if (typeof ltp !== "number") throw new Error(`No LTP for ${symbol}`);
  return ltp;
}

/**
 * BATCH-fetch LTPs for many positions in a single Angel call per exchange.
 * Cuts Orders-screen load time from O(N * 400ms) to O(1 * 400ms).
 * Also caches LTPs for 3 seconds to avoid hammering Angel during the 5s refresh loop.
 */
declare global {
  // eslint-disable-next-line no-var
  var __ltpCache: Map<string, { ltp: number; fetchedAt: number }> | undefined;
}
const ltpCache =
  globalThis.__ltpCache ||
  (globalThis.__ltpCache = new Map<string, { ltp: number; fetchedAt: number }>());
const LTP_CACHE_TTL_MS = 3000;

async function fetchLTPsBatch(
  positions: { symbol: string; exchange: string }[],
): Promise<Map<string, number>> {
  // cache key = `exchange:symbol`
  const out = new Map<string, number>();
  const toFetch: {
    symbol: string;
    exchange: string;
    token: string;
    resolvedExchange: string;
  }[] = [];

  const now = Date.now();

  // Phase 1: resolve tokens + check cache
  await Promise.all(
    positions.map(async (p) => {
      const cacheKey = `${p.exchange}:${p.symbol}`;
      const hit = ltpCache.get(cacheKey);
      if (hit && now - hit.fetchedAt < LTP_CACHE_TTL_MS) {
        out.set(cacheKey, hit.ltp);
        return;
      }
      try {
        let token: string | undefined;
        let resolvedExchange = p.exchange;
        const idx = INDEX_TOKENS[p.symbol.toUpperCase()];
        if (idx) {
          token = idx.token;
          resolvedExchange = idx.exchange;
        } else {
          const inst = await resolveTradable(p.exchange, p.symbol);
          if (inst) {
            token = inst.token;
            resolvedExchange = inst.exch_seg;
          }
        }
        if (token) {
          toFetch.push({ ...p, token, resolvedExchange });
        }
      } catch {
        // skip
      }
    }),
  );

  if (!toFetch.length) return out;

  // Phase 2: group tokens by exchange, one Angel call per exchange
  const tokensByExchange: Record<string, string[]> = {};
  const tokenToEntry = new Map<
    string,
    { symbol: string; exchange: string }
  >();
  for (const f of toFetch) {
    if (!tokensByExchange[f.resolvedExchange]) {
      tokensByExchange[f.resolvedExchange] = [];
    }
    tokensByExchange[f.resolvedExchange].push(f.token);
    tokenToEntry.set(f.token, { symbol: f.symbol, exchange: f.exchange });
  }

  // Angel limits ~50 tokens per call per exchange — chunk if needed
  const CHUNK = 50;
  await Promise.all(
    Object.entries(tokensByExchange).flatMap(([exch, tokens]) => {
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += CHUNK) {
        chunks.push(tokens.slice(i, i + CHUNK));
      }
      return chunks.map(async (chunk) => {
        try {
          const result = await angelPost(
            "/rest/secure/angelbroking/market/v1/quote/",
            { mode: "LTP", exchangeTokens: { [exch]: chunk } },
          );
          const fetched = result?.data?.fetched;
          if (!Array.isArray(fetched)) return;
          for (const q of fetched) {
            const qTok = q.symbolToken || q.symboltoken;
            const entry = tokenToEntry.get(qTok);
            if (!entry) continue;
            const ltp = Number(q.ltp);
            if (!Number.isFinite(ltp)) continue;
            const cacheKey = `${entry.exchange}:${entry.symbol}`;
            out.set(cacheKey, ltp);
            ltpCache.set(cacheKey, { ltp, fetchedAt: now });
          }
        } catch {
          // swallow — positions with no LTP will fall back to avgPrice on the client
        }
      });
    }),
  );

  return out;
}

/** Margin factor for different product types. Full capital for CNC+options, 20% for intraday. */
function marginFactor(productType: string, isOption: boolean): number {
  if (isOption) return 1; // Pay full option premium
  if (productType === "MIS") return 0.2; // 5x leverage for intraday
  if (productType === "NRML") return 0.2; // F&O normal margin
  return 1; // CNC delivery = full
}

/** Brokerage estimate (₹) — caps at ₹20 per order for F&O, free for CNC. */
function brokerageEstimate(totalValue: number, productType: string, isOption: boolean): number {
  if (isOption) return Math.min(20, totalValue * 0.0003);
  if (productType === "MIS") return Math.min(20, totalValue * 0.0003);
  return 0;
}

/** Place a paper trade order with balance deduction/credit. */
export async function placeOrder(params: {
  userId: string;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  qty: number;
  orderType: "MARKET" | "LIMIT";
  limitPrice?: number;
  productType?: string;
  optionType?: string;
  strikePrice?: number;
  expiry?: string;
}): Promise<{ trade: Trade; newBalance: number }> {
  const {
    userId,
    symbol,
    exchange,
    side,
    qty,
    orderType,
    limitPrice,
    productType = "CNC",
    optionType,
    strikePrice,
    expiry,
  } = params;

  if (qty <= 0) throw new Error("Quantity must be positive");

  // For NFO/BFO options: build the full instrument symbol so resolveTradable finds it.
  // e.g. symbol="NIFTY", optionType="CE", strikePrice=24550, expiry="25APR2026"
  //   → tradeSymbol = "NIFTY25APR202624550CE"
  // Skip construction if symbol is already a full option symbol (ends with CE/PE).
  const upperSymbol = symbol.toUpperCase();
  const isFullOptionSymbol = upperSymbol.endsWith("CE") || upperSymbol.endsWith("PE");
  const tradeSymbol =
    optionType && strikePrice && expiry && (exchange === "NFO" || exchange === "BFO") && !isFullOptionSymbol
      ? `${upperSymbol}${expiry.toUpperCase()}${Math.round(strikePrice)}${optionType.toUpperCase()}`
      : symbol;

  // Get real market price
  let executionPrice: number;
  if (orderType === "MARKET") {
    executionPrice = await fetchLTP(tradeSymbol, exchange);
  } else {
    if (!limitPrice || limitPrice <= 0) throw new Error("Limit price required");
    executionPrice = limitPrice;
  }

  const uid = new ObjectId(userId);
  const now = new Date();
  const isOption = !!optionType;
  const totalValue = executionPrice * qty;
  const marginReq = totalValue * marginFactor(productType, isOption);
  const brokerage = brokerageEstimate(totalValue, productType, isOption);

  // Load current user balance
  const db = await getDb();
  const users = db.collection("users");
  const user = await users.findOne({ _id: uid });
  if (!user) throw new Error("User not found");
  const currentBalance = Number(user.tradingBalance ?? 0);

  // BUY: check balance sufficient (margin + brokerage)
  if (side === "BUY") {
    const needed = marginReq + brokerage;
    if (currentBalance < needed) {
      throw new Error(
        `Insufficient balance. Need ₹${needed.toFixed(2)}, available ₹${currentBalance.toFixed(2)}`,
      );
    }
  }

  // SELL: check we have enough holdings/position
  if (side === "SELL") {
    const positions = await positionsCol();
    const existing = await positions.findOne({
      userId: uid,
      symbol: tradeSymbol,
      exchange,
      side: "BUY",
    });

    if (!existing || existing.qty < qty) {
      throw new Error(
        `Insufficient holdings. You have ${existing?.qty || 0} of ${tradeSymbol}`,
      );
    }
  }

  const trade: Trade = {
    userId: uid,
    symbol: tradeSymbol,
    exchange,
    side,
    orderType,
    qty,
    price: executionPrice,
    limitPrice: orderType === "LIMIT" ? limitPrice : undefined,
    status: "EXECUTED",
    productType: productType as any,
    lotSize: 1,
    totalValue,
    segmentKey: "history",
    optionType,
    strikePrice,
    expiry,
    pnl: 0,
    createdAt: now,
    executedAt: now,
  };

  // Insert trade
  const trades = await tradesCol();
  const result = await trades.insertOne(trade);
  trade._id = result.insertedId;

  // Update positions
  await updatePosition(uid, trade);

  // Balance delta: BUY deducts (margin + brokerage), SELL credits (proceeds − brokerage)
  const delta = side === "BUY" ? -(marginReq + brokerage) : totalValue - brokerage;
  const updatedUser = await users.findOneAndUpdate(
    { _id: uid },
    { $inc: { tradingBalance: delta } },
    { returnDocument: "after" },
  );
  const newBalance = Number(updatedUser?.tradingBalance ?? currentBalance + delta);

  return { trade, newBalance };
}

/** Update position after a trade. */
async function updatePosition(userId: ObjectId, trade: Trade) {
  const positions = await positionsCol();
  const key = {
    userId,
    symbol: trade.symbol,
    exchange: trade.exchange,
    ...(trade.optionType
      ? {
          optionType: trade.optionType,
          strikePrice: trade.strikePrice,
          expiry: trade.expiry,
        }
      : { optionType: { $exists: false } }),
  };

  if (trade.side === "BUY") {
    const existing = await positions.findOne(key as any);
    if (existing && existing.side === "BUY") {
      // Average up
      const totalQty = existing.qty + trade.qty;
      const avgPrice =
        (existing.avgPrice * existing.qty + trade.price * trade.qty) / totalQty;
      await positions.updateOne(
        { _id: existing._id },
        { $set: { qty: totalQty, avgPrice, updatedAt: new Date() } },
      );
    } else {
      // New position
      await positions.insertOne({
        userId,
        symbol: trade.symbol,
        exchange: trade.exchange,
        side: "BUY",
        qty: trade.qty,
        avgPrice: trade.price,
        productType: trade.productType,
        lotSize: trade.lotSize,
        optionType: trade.optionType,
        strikePrice: trade.strikePrice,
        expiry: trade.expiry,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } else {
    // SELL — reduce position
    const existing = await positions.findOne({
      userId,
      symbol: trade.symbol,
      exchange: trade.exchange,
      side: "BUY",
      ...(trade.optionType
        ? {
            optionType: trade.optionType,
            strikePrice: trade.strikePrice,
            expiry: trade.expiry,
          }
        : {}),
    });

    if (existing) {
      const remainingQty = existing.qty - trade.qty;
      if (remainingQty <= 0) {
        await positions.deleteOne({ _id: existing._id });
      } else {
        await positions.updateOne(
          { _id: existing._id },
          { $set: { qty: remainingQty, updatedAt: new Date() } },
        );
      }

      // Record P&L on the trade
      const pnl = (trade.price - existing.avgPrice) * trade.qty;
      const trades = await tradesCol();
      await trades.updateOne({ _id: trade._id }, { $set: { pnl } });
    }
  }
}

/** Get user's open positions with live P&L. */
export async function getPositions(userId: string) {
  const positions = await positionsCol();
  const docs = await positions
    .find({ userId: new ObjectId(userId) })
    .sort({ updatedAt: -1 })
    .toArray();

  if (!docs.length) return [];

  // Single batched LTP call for all positions
  const ltpMap = await fetchLTPsBatch(
    docs.map((p) => ({ symbol: p.symbol, exchange: p.exchange })),
  );

  return docs.map((pos) => {
    const ltp = ltpMap.get(`${pos.exchange}:${pos.symbol}`) ?? pos.avgPrice;
    const pnl = (ltp - pos.avgPrice) * pos.qty;
    const pnlPct = pos.avgPrice > 0 ? (pnl / (pos.avgPrice * pos.qty)) * 100 : 0;
    return {
      ...pos,
      ltp,
      pnl,
      pnlPct,
      currentValue: ltp * pos.qty,
      investedValue: pos.avgPrice * pos.qty,
    };
  });
}

/** Get user's trade history. */
export async function getTradeHistory(userId: string, limit = 50) {
  const trades = await tradesCol();
  return trades
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

/** Get holdings (long positions in CNC). */
export async function getHoldings(userId: string) {
  const positions = await positionsCol();
  const docs = await positions
    .find({
      userId: new ObjectId(userId),
      side: "BUY",
      productType: "CNC",
    })
    .sort({ updatedAt: -1 })
    .toArray();

  if (!docs.length) return [];

  const ltpMap = await fetchLTPsBatch(
    docs.map((p) => ({ symbol: p.symbol, exchange: p.exchange })),
  );

  return docs.map((pos) => {
    const ltp = ltpMap.get(`${pos.exchange}:${pos.symbol}`) ?? pos.avgPrice;
    const pnl = (ltp - pos.avgPrice) * pos.qty;
    const pnlPct = pos.avgPrice > 0 ? (pnl / (pos.avgPrice * pos.qty)) * 100 : 0;
    return {
      ...pos,
      ltp,
      pnl,
      pnlPct,
      currentValue: ltp * pos.qty,
      investedValue: pos.avgPrice * pos.qty,
    };
  });
}
