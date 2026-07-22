import { NextResponse } from "next/server";
import { getOtp, markVerified, deleteOtp } from "@/lib/otp-cache";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export async function POST(request: Request) {
  try {
    let rawBody: any;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    const phone = normalizePhone(rawBody.phone ?? "");
    const code = String(rawBody.code ?? "").trim();
    console.log(`[verify-otp] phone="${phone}" code="${code}"`);

    if (!phone || !code) {
      return NextResponse.json({ message: "Phone and OTP are required" }, { status: 400 });
    }

    const entry = getOtp(phone);
    console.log(
      `[verify-otp] cache entry for ${phone}:`,
      entry
        ? `code=${entry.code} verified=${entry.verified} expiresIn=${Math.round((entry.expiresAt - Date.now()) / 1000)}s`
        : "not found",
    );

    if (!entry) {
      return NextResponse.json(
        { message: "No OTP found. Request a new one." },
        { status: 400 },
      );
    }

    if (Date.now() > entry.expiresAt) {
      deleteOtp(phone);
      return NextResponse.json({ message: "OTP expired. Request a new one." }, { status: 400 });
    }

    if (entry.code !== code) {
      return NextResponse.json({ message: "Incorrect OTP. Try again." }, { status: 400 });
    }

    markVerified(phone);
    console.log(`[verify-otp] phone ${phone} marked verified`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[verify-otp] ERROR:", err?.message ?? err);
    return NextResponse.json(
      { message: err?.message || "Verification failed" },
      { status: 500 },
    );
  }
}
