import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { readScopedConfig } from "@/lib/scoped-config";

type WatchlistItem = {
  symbol: string;
  name?: string;
  ltp: number;
  change: number;
  changePct: number;
  details?: {
    about?: string;
    open?: number;
    high?: number;
    low?: number;
    prevClose?: number;
    chart?: Array<{ x: string; y: number }>;
  };
};

type WatchlistConfig = {
  items: WatchlistItem[];
};

const defaultConfig: WatchlistConfig = {
  items: [
    {
      symbol: "RELIANCE",
      name: "Reliance",
      ltp: 2850,
      change: 25,
      changePct: 0.88,
      details: {
        about: "Energy & telecom conglomerate",
        open: 2820,
        high: 2865,
        low: 2810,
        prevClose: 2825,
        chart: [
          { x: "09:15", y: 2825 },
          { x: "11:00", y: 2840 },
          { x: "13:00", y: 2832 },
          { x: "15:30", y: 2850 },
        ],
      },
    },
    {
      symbol: "TCS",
      name: "TCS",
      ltp: 3920,
      change: -18,
      changePct: -0.46,
      details: {
        about: "IT services",
        open: 3940,
        high: 3955,
        low: 3910,
        prevClose: 3938,
        chart: [
          { x: "09:15", y: 3938 },
          { x: "11:00", y: 3925 },
          { x: "13:00", y: 3918 },
          { x: "15:30", y: 3920 },
        ],
      },
    },
  ],
};

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const userId = (user as { _id?: { toString(): string } } | null)?._id?.toString();

    const { config } = await readScopedConfig<WatchlistConfig>({
      key: "dashboard_watchlist",
      userId: userId || null,
      fallback: defaultConfig,
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Config watchlist error:", error);
    return NextResponse.json(
      { message: "Failed to load watchlist" },
      { status: 500 },
    );
  }
}
