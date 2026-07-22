import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db("ajmeraexchange").command({ ping: 1 });

    return NextResponse.json({
      status: "ok",
      message: "Connected to MongoDB successfully",
    });
  } catch (error) {
    console.error("MongoDB health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to connect to MongoDB",
      },
      { status: 500 },
    );
  }
}

