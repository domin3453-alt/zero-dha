import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type StoredImage = {
  data?: Buffer;
  contentType?: string;
};

function toBytes(input: unknown): Uint8Array | null {
  if (!input) return null;

  if (input instanceof Uint8Array) {
    return new Uint8Array(input);
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    return new Uint8Array(input);
  }

  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    const asBufferShape = obj as { type?: unknown; data?: unknown };
    if (asBufferShape.type === "Buffer" && Array.isArray(asBufferShape.data)) {
      return Uint8Array.from(asBufferShape.data as number[]);
    }

    const asBinary = obj as { $binary?: unknown };
    if (asBinary.$binary && typeof asBinary.$binary === "object") {
      const b = asBinary.$binary as Record<string, unknown>;
      const base64 = b.base64;
      if (typeof base64 === "string" && typeof Buffer !== "undefined") {
        return new Uint8Array(Buffer.from(base64, "base64"));
      }
    }

    const maybeBuffer = obj.buffer;
    if (maybeBuffer instanceof Uint8Array) {
      return new Uint8Array(maybeBuffer);
    }
  }

  return null;
}

export async function GET() {
  try {
    const db = await getDb();
    const settings = db.collection("settings");

    const doc = await settings.findOne<{ value?: StoredImage }>({
      key: "fund_qr_image",
    });

    const value = doc?.value;
    if (!value?.data || !value?.contentType) {
      return NextResponse.json({ message: "QR image not set" }, { status: 404 });
    }

    const bytes = toBytes(value.data);
    if (!bytes || bytes.byteLength === 0) {
      return NextResponse.json({ message: "QR image invalid" }, { status: 500 });
    }

    const body = Buffer.from(bytes);

    return new NextResponse(body, {
      headers: {
        "Content-Type": value.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Config fund QR image error:", error);
    return NextResponse.json(
      { message: "Failed to load QR image" },
      { status: 500 },
    );
  }
}
