/**
 * Maps between Yahoo Finance symbols and Angel One symbols/exchanges.
 * Used to bridge the dashboard (Yahoo) → detail screen (Angel One).
 */

export interface AngelSymbolInfo {
  angelSymbol: string;
  exchange: string;
  isIndex?: boolean;
  optionExchange?: string; // NFO for NSE stocks, BFO for BSE, MCX for commodities
  optionUnderlying?: string; // e.g. "NIFTY" for option chain lookups
}

/** Static map for indices and well-known symbols. */
const YAHOO_TO_ANGEL: Record<string, AngelSymbolInfo> = {
  // Indices
  "^NSEI": { angelSymbol: "NIFTY", exchange: "NSE", isIndex: true, optionExchange: "NFO", optionUnderlying: "NIFTY" },
  "^NSEBANK": { angelSymbol: "BANKNIFTY", exchange: "NSE", isIndex: true, optionExchange: "NFO", optionUnderlying: "BANKNIFTY" },
  "^BSESN": { angelSymbol: "SENSEX", exchange: "BSE", isIndex: true, optionExchange: "BFO", optionUnderlying: "SENSEX" },

  // MCX Commodities
  "GC=F": { angelSymbol: "GOLD", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "GOLD" },
  "SI=F": { angelSymbol: "SILVER", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "SILVER" },
  "CL=F": { angelSymbol: "CRUDEOIL", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "CRUDEOIL" },
  "BZ=F": { angelSymbol: "CRUDEOIL", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "CRUDEOIL" },
  "NG=F": { angelSymbol: "NATURALGAS", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "NATURALGAS" },
  "HG=F": { angelSymbol: "COPPER", exchange: "MCX", optionExchange: "MCX", optionUnderlying: "COPPER" },
  "ZW=F": { angelSymbol: "WHEAT", exchange: "MCX" },
  "ZC=F": { angelSymbol: "CORN", exchange: "MCX" },
  "PL=F": { angelSymbol: "PLATINUM", exchange: "MCX" },

  // NSE Equities (Yahoo ".NS" suffix)
  "RELIANCE.NS": { angelSymbol: "RELIANCE", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "RELIANCE" },
  "HDFCBANK.NS": { angelSymbol: "HDFCBANK", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "HDFCBANK" },
  "ICICIBANK.NS": { angelSymbol: "ICICIBANK", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "ICICIBANK" },
  "TCS.NS": { angelSymbol: "TCS", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "TCS" },
  "INFY.NS": { angelSymbol: "INFY", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "INFY" },
  "BHARTIARTL.NS": { angelSymbol: "BHARTIARTL", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "BHARTIARTL" },
  "ITC.NS": { angelSymbol: "ITC", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "ITC" },
  "LICI.NS": { angelSymbol: "LICI", exchange: "NSE", optionExchange: "NFO", optionUnderlying: "LICI" },
};

/**
 * Resolve a Yahoo Finance symbol to Angel One symbol info.
 * For unknown .NS symbols, strips suffix and assumes NSE.
 */
export function resolveAngelSymbol(yahooSymbol: string): AngelSymbolInfo {
  const mapped = YAHOO_TO_ANGEL[yahooSymbol];
  if (mapped) return mapped;

  // Auto-map NSE equities: "SYMBOL.NS" → "SYMBOL" on NSE
  if (yahooSymbol.endsWith(".NS")) {
    const sym = yahooSymbol.replace(".NS", "");
    return {
      angelSymbol: sym,
      exchange: "NSE",
      optionExchange: "NFO",
      optionUnderlying: sym,
    };
  }

  // Auto-map BSE equities: "SYMBOL.BO"
  if (yahooSymbol.endsWith(".BO")) {
    const sym = yahooSymbol.replace(".BO", "");
    return {
      angelSymbol: sym,
      exchange: "BSE",
      optionExchange: "BFO",
      optionUnderlying: sym,
    };
  }

  // Default: assume it's the Angel symbol on NSE
  return { angelSymbol: yahooSymbol, exchange: "NSE" };
}
