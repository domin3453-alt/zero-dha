import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteScopedConfig, readScopedConfig, upsertScopedConfig } from "@/lib/scoped-config";

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

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("ajx_admin");
  return !!adminCookie && adminCookie.value === "ok";
}

function getScopeUserId(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("scopeUserId");
}

export async function GET(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const scopeUserId = getScopeUserId(request);
    const { config, source } = await readScopedConfig<WatchlistConfig>({
      key: "dashboard_watchlist",
      userId: scopeUserId,
      fallback: { items: [] },
    });

    return NextResponse.json({ config, source, scopeUserId: scopeUserId || null });
  } catch (error) {
    return apiErrorResponse(error, "Admin watchlist get error:", "Failed to fetch watchlist");
  }
}

export async function POST(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      config?: WatchlistConfig;
      scopeUserId?: string | null;
    };
    const config = body?.config;

    if (!config) {
      return NextResponse.json(
        { message: "config is required" },
        { status: 400 },
      );
    }

    await upsertScopedConfig<WatchlistConfig>({
      key: "dashboard_watchlist",
      userId: body.scopeUserId || null,
      config,
    });

    return NextResponse.json({ message: "Watchlist updated" });
  } catch (error) {
    return apiErrorResponse(error, "Admin watchlist save error:", "Failed to save watchlist");
  }
}

export async function DELETE(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const scopeUserId = getScopeUserId(request);
    await deleteScopedConfig({ key: "dashboard_watchlist", userId: scopeUserId });

    return NextResponse.json({ message: "Watchlist config deleted" });
  } catch (error) {
    return apiErrorResponse(error, "Admin watchlist delete error:", "Failed to delete watchlist");
  }
}
