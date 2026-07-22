export type OrderRowPnl = {
  side: "BUY" | "SELL";
  pnlManual?: boolean;
  pnl: number;
  lots?: number;
  qty?: number;
  buyPrice?: number;
  sellPrice?: number;
  avgPrice?: number;
  ltp?: number;
};

export function computeOrderPnl(row: OrderRowPnl): number {
  if (row.pnlManual && typeof row.pnl === "number" && Number.isFinite(row.pnl)) {
    return row.pnl;
  }

  const lots = Number(row.lots ?? row.qty ?? 0);
  const buy = Number(row.buyPrice ?? row.avgPrice ?? 0);
  const sell = Number(row.sellPrice ?? row.ltp ?? 0);

  if (row.side === "SELL") {
    return (buy - sell) * lots;
  }
  return (sell - buy) * lots;
}
