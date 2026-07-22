import { UTApi } from "uploadthing/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — matches typical UploadThing image limits

/**
 * POST multipart/form-data with field `file` (image).
 * Uploads to UploadThing via UTApi and returns { url, key } for the client to send with registration.
 * Use this from Expo/React Native so the signature never relies on embedding large files in the main register request.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.UPLOADTHING_TOKEN?.trim()) {
      return NextResponse.json(
        { message: "Server missing UPLOADTHING_TOKEN" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const entry = formData.get("file");

    if (!entry || !(entry instanceof File)) {
      return NextResponse.json({ message: "Missing file" }, { status: 400 });
    }

    if (entry.size > MAX_BYTES) {
      return NextResponse.json(
        { message: "File too large (max 4MB)" },
        { status: 400 },
      );
    }

    const utapi = new UTApi();
    const out = (await utapi.uploadFiles(entry)) as {
      data?: { ufsUrl?: string; url?: string; key?: string } | null;
      error?: { message?: string } | null;
    };

    if (out?.error) {
      const msg = out.error.message || "Upload failed";
      return NextResponse.json({ message: msg }, { status: 502 });
    }

    const data = out?.data;
    if (!data) {
      return NextResponse.json(
        { message: "UploadThing returned no file data" },
        { status: 502 },
      );
    }

    const url = data.ufsUrl || data.url;
    if (!url) {
      return NextResponse.json(
        { message: "UploadThing returned no URL" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url,
      key: data.key ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ message: msg || "Upload failed" }, { status: 500 });
  }
}
