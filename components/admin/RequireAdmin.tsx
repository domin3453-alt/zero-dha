"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GateState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string; code?: string };

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/users", { credentials: "include" });
        if (cancelled) return;

        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            message?: string;
            code?: string;
          };
          setState({
            kind: "error",
            message:
              data.message ||
              (res.status === 503
                ? "Service temporarily unavailable."
                : "Could not verify admin session."),
            code: data.code,
          });
          return;
        }

        setState({ kind: "ready" });
      } catch {
        if (!cancelled) {
          setState({
            kind: "error",
            message: "Network error while checking admin session.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-600">Checking admin session…</p>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    const isDb = state.code === "MONGO_AUTH_FAILED";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-800">
            {isDb ? "Database connection failed" : "Admin panel unavailable"}
          </p>
          <p className="mt-2 text-sm text-slate-600">{state.message}</p>
          {isDb ? (
            <p className="mt-3 text-xs text-slate-500">
              Fix <code className="rounded bg-slate-100 px-1">MONGO_URI</code> in{" "}
              <code className="rounded bg-slate-100 px-1">.env.local</code>, restart{" "}
              <code className="rounded bg-slate-100 px-1">npm run dev</code>, then reload.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
