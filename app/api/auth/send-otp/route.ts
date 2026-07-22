import { NextResponse } from "next/server";
import { setOtp } from "@/lib/otp-cache";

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

async function sendSms(phone: string, otp: string): Promise<void> {
  const apiKey = process.env.SMS_API_KEY;
  console.log("[send-otp] SMS_API_KEY present:", !!apiKey);

  if (!apiKey) throw new Error("SMS_API_KEY not configured in .env");

  const url = `https://sms.renflair.in/V1.php?API=${apiKey}&PHONE=${phone}&OTP=${otp}`;
  console.log(`[send-otp] Calling SMS API → PHONE=${phone} OTP=${otp} (key last4=...${apiKey.slice(-4)})`);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (fetchErr: any) {
    console.error("[send-otp] fetch() threw:", fetchErr?.message ?? fetchErr);
    throw new Error(`SMS fetch error: ${fetchErr?.message ?? String(fetchErr)}`);
  }

  const body = await res.text().catch(() => "(unreadable)");
  console.log(`[send-otp] SMS API status=${res.status} body=${body}`);

  if (!res.ok) {
    throw new Error(`SMS API HTTP ${res.status}: ${body}`);
  }
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
    console.log(`[send-otp] request phone raw="${rawBody.phone}" normalised="${phone}"`);

    if (phone.length !== 10) {
      return NextResponse.json(
        { message: "Enter a valid 10-digit phone number" },
        { status: 400 },
      );
    }

    const code = generateOtp();
    setOtp(phone, code);
    console.log(`[send-otp] OTP generated and cached for ${phone}`);

    await sendSms(phone, code);
    console.log(`[send-otp] SMS dispatched successfully for ${phone}`);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[send-otp] ERROR:", err?.message ?? err);
    return NextResponse.json(
      { message: err?.message || "Failed to send OTP" },
      { status: 500 },
    );
  }
}
