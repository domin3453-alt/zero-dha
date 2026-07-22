import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { message: "Not authenticated" },
        { status: 401 },
      );
    }

    const u = user as Record<string, unknown> & {
      passwordHash?: string;
      documents?: { photo?: { data?: unknown } };
    };

    const { passwordHash, documents, ...rest } = u;

    const tradingBalance = (rest.tradingBalance as number | undefined) ?? 0;
    const margin = (rest.margin as number | undefined) ?? 0;

    const hasProfilePhoto = Boolean(documents?.photo?.data);

    return NextResponse.json({
      user: {
        ...rest,
        tradingBalance,
        margin,
        hasProfilePhoto,
      },
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { message: "Failed to load user" },
      { status: 500 },
    );
  }
}

