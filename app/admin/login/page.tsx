"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FiLock } from "react-icons/fi";

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      window.localStorage.setItem("ajmera_admin_ok", "true");
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <FiLock className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter the PIN configured as{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">ADMIN_PIN</code>{" "}
          on the server.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500">PIN</label>
            <div className="relative mt-1">
              <input
                type={show ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-4"
                placeholder="••••••••"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setShow(!show)}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{err}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
