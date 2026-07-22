import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteScopedConfig, readScopedConfig, upsertScopedConfig } from "@/lib/scoped-config";

type HomeConfig = {
  indices?: Array<{
    name: string;
    value: number;
    change: number;
    changePct: number;
    tvSymbol?: string;
  }>;
  chart?: {
    title?: string;
    points: Array<{ x: string; y: number }>;
  };
  stocks?: Array<{
    symbol: string;
    name?: string;
    ltp: number;
    change: number;
    changePct: number;
  }>;
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
    const { config, source } = await readScopedConfig<HomeConfig>({
      key: "dashboard_home",
      userId: scopeUserId,
      fallback: { indices: [], stocks: [] },
    });

    return NextResponse.json({ config, source, scopeUserId: scopeUserId || null });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Admin dashboard home get error:",
      "Failed to fetch dashboard home",
    );
  }
}

export async function POST(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      config?: HomeConfig;
      scopeUserId?: string | null;
    };
    const config = body?.config;

    if (!config) {
      return NextResponse.json(
        { message: "config is required" },
        { status: 400 },
      );
    }

    await upsertScopedConfig<HomeConfig>({
      key: "dashboard_home",
      userId: body.scopeUserId || null,
      config,
    });

    return NextResponse.json({ message: "Dashboard home updated" });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Admin dashboard home save error:",
      "Failed to save dashboard home",
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const scopeUserId = getScopeUserId(request);
    await deleteScopedConfig({ key: "dashboard_home", userId: scopeUserId });

    return NextResponse.json({ message: "Dashboard home config deleted" });
  } catch (error) {
    return apiErrorResponse(
      error,
      "Admin dashboard home delete error:",
      "Failed to delete dashboard home",
    );
  }
}
