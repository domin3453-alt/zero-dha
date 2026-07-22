import { apiErrorResponse } from "@/lib/api-error";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

type StoredImage = {
  data: Buffer;
  contentType: string;
  filename?: string | null;
};

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("ajx_admin");
  return !!adminCookie && adminCookie.value === "ok";
}

export async function GET() {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const settings = db.collection("settings");

    const doc = await settings.findOne<{ value?: StoredImage }>({
      key: "fund_qr_image",
    });

    return NextResponse.json({
      hasImage: !!doc?.value?.data,
      contentType: doc?.value?.contentType || null,
      filename: doc?.value?.filename || null,
    });
  } catch (error) {
    return apiErrorResponse(error, "Admin QR image get error:", "Failed to fetch QR image");
  }
}

export async function POST(request: Request) {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { message: "File is required" },
        { status: 400 },
      );
    }

    if (!fileEntry.type || !fileEntry.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only image files are allowed" },
        { status: 400 },
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    const db = await getDb();
    const settings = db.collection("settings");

    await settings.updateOne(
      { key: "fund_qr_image" },
      {
        $set: {
          value: {
            data,
            contentType: fileEntry.type,
            filename: fileEntry.name || null,
          },
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ message: "QR image uploaded" });
  } catch (error) {
    return apiErrorResponse(error, "Admin QR image upload error:", "Failed to upload QR image");
  }
}

export async function DELETE() {
  try {
    const ok = await requireAdmin();
    if (!ok) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const settings = db.collection("settings");

    await settings.updateOne(
      { key: "fund_qr_image" },
      { $set: { value: null, updatedAt: new Date() } },
      { upsert: true },
    );

    return NextResponse.json({ message: "QR image deleted" });
  } catch (error) {
    return apiErrorResponse(error, "Admin QR image delete error:", "Failed to delete QR image");
  }
}
