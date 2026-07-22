import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

function cleanStr(v: unknown): string {
  return (v ?? "").toString().trim();
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const fullName = cleanStr(body?.fullName);
    const email = cleanStr(body?.email).toLowerCase();
    const phone = cleanStr(body?.phone);
    const panNumber = cleanStr(body?.panNumber).toUpperCase();
    const aadhaarNumber = cleanStr(body?.aadhaarNumber).replace(/\s+/g, "");
    const accountNo = cleanStr(body?.accountNo);
    const ifscCode = cleanStr(body?.ifscCode).toUpperCase();
    const documentType = cleanStr(body?.documentType);

    // No format validation — save whatever the user entered
    const db = await getDb();
    const users = db.collection("users");
    const userId = new ObjectId((user as { _id: ObjectId })._id);

    if (email) {
      const existing = await users.findOne<{ _id: ObjectId }>({
        email,
        _id: { $ne: userId },
      });
      if (existing) {
        return NextResponse.json({ message: "Email already in use" }, { status: 400 });
      }
    }

    const current = await users.findOne<{
      fullName?: string;
      email?: string;
      phone?: string;
      bankDetails?: { accountNo?: string; ifscCode?: string; documentType?: string };
    }>({ _id: userId });

    const prevBank = current?.bankDetails || {};

    await users.updateOne(
      { _id: userId },
      {
        $set: {
          fullName: fullName || current?.fullName || "",
          email: email || current?.email || "",
          phone: phone || current?.phone || "",
          panNumber: panNumber || null,
          aadhaarNumber: aadhaarNumber || null,
          bankDetails: {
            accountNo: accountNo || prevBank.accountNo || "",
            ifscCode: ifscCode || prevBank.ifscCode || "",
            documentType: documentType || prevBank.documentType || "",
          },
          updatedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ message: "Profile updated" });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
  }
}
