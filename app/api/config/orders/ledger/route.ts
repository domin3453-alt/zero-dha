import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getEffectiveOrdersConfigForUser } from "@/lib/effective-orders-config";

function escapeCsv(value: unknown) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const userId = (user as { _id?: { toString(): string } } | null)?._id?.toString();

    if (!userId) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const config = await getEffectiveOrdersConfigForUser(userId);

    const orders = Array.isArray(config.orders) ? config.orders : [];
    const header = [
      "Trade ID",
      "Date",
      "Time",
      "Segment",
      "Market",
      "Exchange",
      "Symbol",
      "Side",
      "Product",
      "Expiry Date",
      "Quantity",
      "Average Price",
      "LTP",
      "PnL",
      "Status",
    ];

    const rows = orders.map((order) => [
      order.id,
      order.startDate || "",
      order.time || "",
      order.segmentKey,
      order.market || "",
      order.exchange || "",
      order.symbol,
      order.side,
      order.productType || "",
      order.expiryDate || "",
      order.qty,
      order.avgPrice,
      order.ltp,
      order.pnl,
      order.status,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ledger.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Ledger download error:", error);
    return NextResponse.json({ message: "Failed to generate ledger" }, { status: 500 });
  }
}
