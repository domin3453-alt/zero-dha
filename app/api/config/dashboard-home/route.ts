import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type MarketQuote = {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePct: number;
  tvSymbol: string;
  currency?: string;
  marketTime?: number | null;
};

type MutualFundQuote = {
  schemeCode: number | null;
  name: string;
  nav: number;
  change: number;
  changePct: number;
  asOf: string | null;
  fundHouse?: string;
  category?: string;
};

type HomeConfig = {
  /** USD→INR (from Yahoo `INR=X`) for showing global futures in ₹ approx. */
  usdInr?: number;
  indices: MarketQuote[];
  stocks: Array<{
    symbol: string;
    name: string;
    ltp: number;
    change: number;
    changePct: number;
    tvSymbol?: string;
  }>;
  commodities: MarketQuote[];
  mutualFunds: MutualFundQuote[];
  updatedAt: string;
};

const REQUEST_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Yahoo often blocks anonymous requests without a finance.yahoo referer. */
const YAHOO_EXTRA_HEADERS: Record<string, string> = {
  Referer: "https://finance.yahoo.com/quote/",
  Origin: "https://finance.yahoo.com",
};

const INDEX_DEFS = [
  { label: "NIFTY", symbol: "^NSEI", tvSymbol: "NSE:NIFTY" },
  /** Bank Nifty — distinct from NIFTY 50 */
  { label: "BANK NIFTY", symbol: "^NSEBANK", tvSymbol: "NSE:BANKNIFTY" },
  { label: "SENSEX", symbol: "^BSESN", tvSymbol: "BSE:SENSEX" },
];

const STOCK_DEFS = [
  { label: "Reliance", symbol: "RELIANCE.NS", tvSymbol: "NSE:RELIANCE" },
  { label: "HDFC Bank", symbol: "HDFCBANK.NS", tvSymbol: "NSE:HDFCBANK" },
  { label: "ICICI Bank", symbol: "ICICIBANK.NS", tvSymbol: "NSE:ICICIBANK" },
  { label: "TCS", symbol: "TCS.NS", tvSymbol: "NSE:TCS" },
  { label: "Infosys", symbol: "INFY.NS", tvSymbol: "NSE:INFY" },
  { label: "Bharti Airtel", symbol: "BHARTIARTL.NS", tvSymbol: "NSE:BHARTIARTL" },
  { label: "ITC", symbol: "ITC.NS", tvSymbol: "NSE:ITC" },
  { label: "LIC India", symbol: "LICI.NS", tvSymbol: "NSE:LICI" },
];

/** Nine liquid futures — Yahoo (delayed ~15m); TradingView uses free TVC synthetics for embeds */
const COMMODITY_DEFS = [
  { label: "Gold", symbol: "GC=F", tvSymbol: "TVC:GOLD" },
  { label: "Silver", symbol: "SI=F", tvSymbol: "TVC:SILVER" },
  { label: "Crude Oil WTI", symbol: "CL=F", tvSymbol: "TVC:USOIL" },
  { label: "Brent Crude", symbol: "BZ=F", tvSymbol: "TVC:UKOIL" },
  { label: "Natural Gas", symbol: "NG=F", tvSymbol: "NYMEX:NG1!" },
  { label: "Copper", symbol: "HG=F", tvSymbol: "COMEX:HG1!" },
  // Platinum (PL=F), Wheat (ZW=F), Corn (ZC=F) — not listed on MCX/Angel One
];

const MUTUAL_FUND_QUERIES = [
  "Parag Parikh Flexi Cap Fund Direct Growth",
  "HDFC Top 100 Fund Direct Plan Growth",
  "SBI Small Cap Fund Direct Plan Growth",
  "Axis Bluechip Fund Direct Plan Growth",
];

const fallbackConfig: HomeConfig = {
  indices: [
    {
      name: "NIFTY",
      symbol: "^NSEI",
      value: 22410.3,
      change: 146.2,
      changePct: 0.66,
      tvSymbol: "NSE:NIFTY",

    },
    {
      name: "BANK NIFTY",
      symbol: "^NSEBANK",
      value: 48120.5,
      change: 210.4,
      changePct: 0.44,
      tvSymbol: "NSE:BANKNIFTY",

    },
    {
      name: "SENSEX",
      symbol: "^BSESN",
      value: 73982.8,
      change: 412.5,
      changePct: 0.56,
      tvSymbol: "BSE:SENSEX",

    },
  ],
  stocks: [
    {
      symbol: "RELIANCE.NS",
      name: "Reliance",
      ltp: 2850,
      change: 25,
      changePct: 0.88,
      tvSymbol: "NSE:RELIANCE",

    },
    {
      symbol: "HDFCBANK.NS",
      name: "HDFC Bank",
      ltp: 1540,
      change: 6,
      changePct: 0.39,
      tvSymbol: "NSE:HDFCBANK",

    },
    {
      symbol: "ICICIBANK.NS",
      name: "ICICI Bank",
      ltp: 1120,
      change: 8,
      changePct: 0.72,
      tvSymbol: "NSE:ICICIBANK",

    },
    {
      symbol: "TCS.NS",
      name: "TCS",
      ltp: 3920,
      change: -18,
      changePct: -0.46,
      tvSymbol: "NSE:TCS",

    },
    {
      symbol: "INFY.NS",
      name: "Infosys",
      ltp: 1610,
      change: 14,
      changePct: 0.88,
      tvSymbol: "NSE:INFY",

    },
    {
      symbol: "BHARTIARTL.NS",
      name: "Bharti Airtel",
      ltp: 1580,
      change: -12,
      changePct: -0.75,
      tvSymbol: "NSE:BHARTIARTL",

    },
    {
      symbol: "ITC.NS",
      name: "ITC",
      ltp: 415,
      change: 3,
      changePct: 0.73,
      tvSymbol: "NSE:ITC",

    },
    {
      symbol: "LICI.NS",
      name: "LIC India",
      ltp: 920,
      change: -5,
      changePct: -0.54,
      tvSymbol: "NSE:LICI",

    },
  ],
  commodities: [
    {
      name: "Gold",
      symbol: "GC=F",
      value: 2168.4,
      change: 11.3,
      changePct: 0.52,
      tvSymbol: "TVC:GOLD",

      currency: "USD",
    },
    {
      name: "Silver",
      symbol: "SI=F",
      value: 24.5,
      change: -0.14,
      changePct: -0.57,
      tvSymbol: "TVC:SILVER",

      currency: "USD",
    },
    {
      name: "Crude Oil WTI",
      symbol: "CL=F",
      value: 81.2,
      change: 0.92,
      changePct: 1.15,
      tvSymbol: "TVC:USOIL",

      currency: "USD",
    },
    {
      name: "Brent Crude",
      symbol: "BZ=F",
      value: 84.1,
      change: 0.55,
      changePct: 0.66,
      tvSymbol: "TVC:UKOIL",

      currency: "USD",
    },
    {
      name: "Natural Gas",
      symbol: "NG=F",
      value: 2.14,
      change: -0.06,
      changePct: -2.73,
      tvSymbol: "NYMEX:NG1!",

      currency: "USD",
    },
    {
      name: "Copper",
      symbol: "HG=F",
      value: 4.12,
      change: 0.03,
      changePct: 0.73,
      tvSymbol: "COMEX:HG1!",

      currency: "USD",
    },
  ],
  mutualFunds: [
    {
      schemeCode: null,
      name: "Parag Parikh Flexi Cap Fund Direct Growth",
      nav: 90.43,
      change: 0.66,
      changePct: 0.73,
      asOf: null,
      fundHouse: "PPFAS Mutual Fund",
      category: "Flexi Cap",
    },
    {
      schemeCode: 125497,
      name: "HDFC Top 100 Fund Direct Plan Growth",
      nav: 892.46,
      change: 2.54,
      changePct: 0.28,
      asOf: null,
      fundHouse: "HDFC Mutual Fund",
      category: "Large Cap",
    },
  ],
  usdInr: 83,
  updatedAt: new Date().toISOString(),
};

async function fetchJson<T>(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const response = await fetch(url, {
    headers: { ...REQUEST_HEADERS, ...extraHeaders },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        previousClose?: number;
        symbol?: string;
        currency?: string;
        exchangeName?: string;
        regularMarketTime?: number;
      };
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

/** v7 quote — same day change / % as Yahoo’s UI (avoids chart API baseline bugs). */
type YahooQuoteV7Response = {
  quoteResponse?: {
    result?: Array<{
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketPreviousClose?: number;
      shortName?: string;
      symbol?: string;
      currency?: string;
      regularMarketTime?: number;
    }>;
  };
};

async function fetchYahooQuoteV7(
  def: { label: string; symbol: string; tvSymbol: string },
): Promise<MarketQuote | null> {
  const sym = encodeURIComponent(def.symbol);
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${sym}`,
  ];

  for (const url of urls) {
    try {
      const data = await fetchJson<YahooQuoteV7Response>(url, YAHOO_EXTRA_HEADERS);
      const q = data.quoteResponse?.result?.[0];
      if (!q || q.regularMarketPrice == null) continue;

      const value = Number(q.regularMarketPrice);
      if (!Number.isFinite(value)) continue;

      let change = Number(q.regularMarketChange);
      let changePct = Number(q.regularMarketChangePercent);
      const prev = q.regularMarketPreviousClose;

      if (!Number.isFinite(change) && prev != null) {
        change = value - Number(prev);
      }
      if (!Number.isFinite(changePct) && prev != null && Number(prev) !== 0) {
        changePct = (change / Number(prev)) * 100;
      }
      if (!Number.isFinite(change)) change = 0;
      if (!Number.isFinite(changePct)) changePct = 0;

      const cur = q.currency?.trim();
      /** Yahoo often omits currency for CBOT/COMEX/NYMEX futures; quotes are USD-denominated. */
      const currency =
        cur && cur.length > 0 ? cur : def.symbol.includes("=F") ? "USD" : cur;

      return {
        name: def.label,
        symbol: def.symbol,
        value,
        change,
        changePct,
        tvSymbol: def.tvSymbol,
  
        currency,
        marketTime: q.regularMarketTime ?? null,
      };
    } catch {
      /* try next host */
    }
  }

  return null;
}

/**
 * Chart fallback: do **not** use `chartPreviousClose` for day-over-day change — it anchors to the
 * wrong date on multi-day ranges and inflates moves. Prefer `meta.previousClose` only, then last
 * two daily closes.
 */
async function fetchYahooQuoteFromChart(def: {
  label: string;
  symbol: string;
  tvSymbol: string;
}): Promise<MarketQuote> {
  const enc = encodeURIComponent(def.symbol);
  const qs = "range=5d&interval=1d&includePrePost=false";
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${enc}?${qs}`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${enc}?${qs}`,
  ];

  let lastErr: unknown = null;
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchJson<YahooChartResponse>(url, YAHOO_EXTRA_HEADERS);
        const result = data.chart?.result?.[0];
        if (!result) {
          throw new Error("Yahoo chart: empty result");
        }
        const meta = result.meta || {};
        const closes = (result.indicators?.quote?.[0]?.close || []).filter(
          (value): value is number => typeof value === "number",
        );

        const current = Number(meta.regularMarketPrice ?? closes.at(-1) ?? 0);
        if (!Number.isFinite(current)) {
          throw new Error("Yahoo chart: no price");
        }

        const prevClose = Number(meta.previousClose);
        let previous: number;
        if (Number.isFinite(prevClose) && prevClose > 0) {
          previous = prevClose;
        } else if (closes.length >= 2) {
          previous = closes[closes.length - 2]!;
        } else {
          previous = current;
        }

        const change = current - previous;
        const changePct = previous ? (change / previous) * 100 : 0;

        const cur = meta.currency?.trim();
        const currency =
          cur && cur.length > 0 ? cur : def.symbol.includes("=F") ? "USD" : cur;

        return {
          name: def.label,
          symbol: def.symbol,
          value: current,
          change,
          changePct,
          tvSymbol: def.tvSymbol,
    
          currency,
          marketTime: meta.regularMarketTime ?? null,
        };
      } catch (e) {
        lastErr = e;
        await sleep(180 * (attempt + 1));
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function fetchYahooQuote(def: {
  label: string;
  symbol: string;
  tvSymbol: string;
}): Promise<MarketQuote> {
  const fromQuote = await fetchYahooQuoteV7(def);
  if (fromQuote) {
    return fromQuote;
  }
  return fetchYahooQuoteFromChart(def);
}

/** Yahoo USD/INR spot for converting international futures to approximate ₹. */
async function fetchUsdInrRate(): Promise<number> {
  try {
    const q = await fetchYahooQuoteV7({
      label: "USDINR",
      symbol: "INR=X",
      tvSymbol: "FX_IDC:USDINR",
    });
    const v = q?.value;
    if (typeof v === "number" && Number.isFinite(v) && v > 60 && v < 200) {
      return v;
    }
  } catch {
    /* use default */
  }
  return 83;
}

type MfSearchResponse = Array<{
  schemeCode: number;
  schemeName: string;
}>;

type MfHistoryResponse = {
  meta?: {
    scheme_code?: number;
    scheme_name?: string;
    fund_house?: string;
    scheme_category?: string;
  };
  data?: Array<{
    date?: string;
    nav?: string;
  }>;
};

async function fetchMutualFund(query: string): Promise<MutualFundQuote> {
  const searchUrl = `https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`;
  const search = await fetchJson<MfSearchResponse>(searchUrl);
  const first = search[0];

  if (!first) {
    throw new Error(`No mutual fund match for ${query}`);
  }

  const historyUrl = `https://api.mfapi.in/mf/${first.schemeCode}`;
  const history = await fetchJson<MfHistoryResponse>(historyUrl);
  const latest = history.data?.[0];
  const previous = history.data?.[1];
  const nav = Number(latest?.nav ?? 0);
  const prevNav = Number(previous?.nav ?? nav);
  const change = nav - prevNav;
  const changePct = prevNav ? (change / prevNav) * 100 : 0;

  return {
    schemeCode: history.meta?.scheme_code ?? first.schemeCode,
    name: history.meta?.scheme_name || first.schemeName,
    nav,
    change,
    changePct,
    asOf: latest?.date ?? null,
    fundHouse: history.meta?.fund_house,
    category: history.meta?.scheme_category,
  };
}

async function settleQuotes(
  defs: Array<{ label: string; symbol: string; tvSymbol: string }>,
  fallback: MarketQuote[],
) {
  const settled = await Promise.allSettled(defs.map(fetchYahooQuote));
  return settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : fallback[index],
  );
}

/** All symbols in COMMODITY_DEFS are US-listed futures; Yahoo sometimes omits `currency` (e.g. ZC=F, ZW=F). */
function normalizeCommodityQuotes(
  quotes: MarketQuote[],
  defs: typeof COMMODITY_DEFS,
): MarketQuote[] {
  return quotes.map((q, index) => {
    const def = defs[index];
    return {
      ...q,
      name: def?.label ?? q.name,
      symbol: def?.symbol ?? q.symbol,
      tvSymbol: def?.tvSymbol ?? q.tvSymbol,
      currency: "USD",
    };
  });
}

export async function GET() {
  try {
    const stockFallbackQuotes: MarketQuote[] = STOCK_DEFS.map((d, index) => {
      const stock = fallbackConfig.stocks[index];
      return {
        name: stock?.name ?? d.label,
        symbol: d.symbol,
        value: stock?.ltp ?? 0,
        change: stock?.change ?? 0,
        changePct: stock?.changePct ?? 0,
        tvSymbol: d.tvSymbol,
  
      };
    });

    const [indices, stocksRaw, commoditiesRaw, mutualFundsSettled, usdInr] =
      await Promise.all([
        settleQuotes(INDEX_DEFS, fallbackConfig.indices),
        settleQuotes(STOCK_DEFS, stockFallbackQuotes),
        settleQuotes(COMMODITY_DEFS, fallbackConfig.commodities),
        Promise.allSettled(MUTUAL_FUND_QUERIES.map(fetchMutualFund)),
        fetchUsdInrRate(),
      ]);

    const commodities = normalizeCommodityQuotes(commoditiesRaw, COMMODITY_DEFS);

    const liveStocks = stocksRaw
      .map((quote, index) => ({
        symbol: STOCK_DEFS[index].symbol,
        name: quote.name,
        ltp: quote.value,
        change: quote.change,
        changePct: quote.changePct,
        tvSymbol: quote.tvSymbol,
      }))
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    const mutualFunds = mutualFundsSettled
      .map((result, index) =>
        result.status === "fulfilled"
          ? result.value
          : fallbackConfig.mutualFunds[index] || null,
      )
      .filter((item): item is MutualFundQuote => Boolean(item));

    return NextResponse.json({
      config: {
        usdInr,
        indices,
        stocks: liveStocks,
        commodities,
        mutualFunds,
        updatedAt: new Date().toISOString(),
      } satisfies HomeConfig,
    });
  } catch (error) {
    console.error("Config dashboard home error:", error);
    return NextResponse.json({ config: fallbackConfig });
  }
}
