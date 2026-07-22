import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type FundPaymentMeta = {
  upiId?: string | null;
  bankName?: string | null;
  accountHolder?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const db = await getDb();
    const settings = db.collection("settings");

    const imgDoc = await settings.findOne<{ value?: { data?: unknown } }>({
      key: "fund_qr_image",
    });

    if (imgDoc?.value?.data) {
      const metaDoc = await settings.findOne<{ value?: FundPaymentMeta }>({
        key: "fund_payment_meta",
      });
      return NextResponse.json({
        qrUrl: "/api/config/fund-qr-image",
        paymentMeta: metaDoc?.value || null,
      });
    }

    const doc = await settings.findOne<{ value?: string }>({
      key: "fund_qr_url",
    });

    const metaDoc = await settings.findOne<{ value?: FundPaymentMeta }>({
      key: "fund_payment_meta",
    });

    return NextResponse.json({
      qrUrl: doc?.value || null,
      paymentMeta: metaDoc?.value || null,
    });
  } catch (error) {
    return apiErrorResponse(error, "Admin QR get error:", "Failed to fetch QR");
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("ajx_admin");
    if (!adminCookie || adminCookie.value !== "ok") {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      qrUrl?: string | null;
      paymentMeta?: FundPaymentMeta | null;
    };
    const { qrUrl, paymentMeta } = body || {};

    const db = await getDb();
    const settings = db.collection("settings");

    await settings.updateOne(
      { key: "fund_qr_url" },
      { $set: { value: qrUrl || null, updatedAt: new Date() } },
      { upsert: true },
    );

    await settings.updateOne(
      { key: "fund_payment_meta" },
      {
        $set: {
          value: {
            upiId: paymentMeta?.upiId || null,
            bankName: paymentMeta?.bankName || null,
            accountHolder: paymentMeta?.accountHolder || null,
            accountNumber: paymentMeta?.accountNumber || null,
            ifsc: paymentMeta?.ifsc || null,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ message: "QR updated" });
  } catch (error) {
    return apiErrorResponse(error, "Admin QR save error:", "Failed to save QR");
  }
}
