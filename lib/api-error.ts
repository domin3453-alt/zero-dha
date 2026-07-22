import { MongoServerError } from "mongodb";
import { NextResponse } from "next/server";

/**
 * Maps known MongoDB failures (e.g. Atlas bad auth) to stable JSON + HTTP status.
 * Always logs the underlying error server-side.
 */
export function apiErrorResponse(
  error: unknown,
  logLabel: string,
  fallbackMessage: string,
): NextResponse {
  console.error(logLabel, error);

  if (error instanceof MongoServerError) {
    const msg = String(error.message || "");
    const code = error.code;
    if (
      code === 18 ||
      code === 8000 ||
      /bad auth|authentication failed/i.test(msg)
    ) {
      return NextResponse.json(
        {
          message:
            "Database authentication failed. Verify MONGO_URI (or MONGODB_URI) in .env.local: correct Atlas username and password, and that the user is allowed on this cluster.",
          code: "MONGO_AUTH_FAILED",
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json(
    { message: fallbackMessage, code: "INTERNAL" },
    { status: 500 },
  );
}
