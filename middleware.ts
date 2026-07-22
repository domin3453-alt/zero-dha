import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Explicit allowlist (production + dev). Trailing slashes normalized. */
const DEFAULT_ALLOWED = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://[::1]:8081",
];

function normalizeOrigin(o: string): string {
  return o.replace(/\/$/, "");
}

function loadAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  for (const o of DEFAULT_ALLOWED) {
    set.add(normalizeOrigin(o));
  }
  const extra = process.env.CORS_ALLOWED_ORIGINS;
  if (extra) {
    for (const part of extra.split(",")) {
      const t = part.trim();
      if (t) set.add(normalizeOrigin(t));
    }
  }
  return set;
}

const ALLOWED_ORIGINS = loadAllowedOrigins();

/** Browser may omit Origin on some edge paths; Referer still shows the page origin. */
function getRequestOrigin(request: NextRequest): string | null {
  const o = request.headers.get("origin");
  if (o) return o;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    return (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      h === "::1"
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const n = normalizeOrigin(origin);
  if (ALLOWED_ORIGINS.has(n)) return true;
  if (process.env.CORS_ALLOW_LOCALHOST === "true") {
    try {
      const u = new URL(n);
      return u.hostname === "localhost" || u.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  }
  if (isLocalDevOrigin(n)) return true;
  return false;
}

const STATIC_ALLOW_HEADERS =
  "Authorization, Content-Type, X-Requested-With, Accept, ngrok-skip-browser-warning";

function mergeAllowHeaders(request: NextRequest): string {
  const requested = request.headers.get("access-control-request-headers");
  if (!requested) return STATIC_ALLOW_HEADERS;
  const set = new Set<string>();
  for (const part of STATIC_ALLOW_HEADERS.split(",")) {
    const t = part.trim();
    if (t) set.add(t);
  }
  for (const part of requested.split(",")) {
    const t = part.trim();
    if (t) set.add(t);
  }
  return [...set].join(", ");
}

function buildCorsHeaders(request: NextRequest, origin: string | null): Headers {
  const h = new Headers();
  if (!isAllowedOrigin(origin)) {
    return h;
  }
  const allowOrigin = normalizeOrigin(origin!);
  h.set("Access-Control-Allow-Origin", allowOrigin);
  h.set("Access-Control-Allow-Credentials", "true");
  h.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
  );
  h.set("Access-Control-Allow-Headers", mergeAllowHeaders(request));
  h.set("Vary", "Origin");
  h.set("Access-Control-Max-Age", "86400");
  return h;
}

export function middleware(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const headers = buildCorsHeaders(request, origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  headers.forEach((value, key) => {
    res.headers.set(key, value);
  });
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
