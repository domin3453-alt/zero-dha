"use client";

import { useCallback, useEffect, useState } from "react";
import { adminJson } from "@/components/admin/adminFetch";
import { ScopeUserBar } from "@/components/admin/ScopeUserBar";

type Item = {
  symbol: string;
  name?: string;
  ltp: number;
  change: number;
  changePct: number;
};
type UserOpt = { _id: string; clientId?: string; email?: string; fullName?: string };

export default function AdminWatchlistPage() {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [scopeUserId, setScopeUserId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminJson<{ users: UserOpt[] }>("/api/admin/users");
      setUsers(data.users || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setErr(null);
    const q = scopeUserId ? `?scopeUserId=${encodeURIComponent(scopeUserId)}` : "";
    try {
      const data = await adminJson<{ config?: { items?: Item[] }; source?: string }>(
        `/api/admin/watchlist${q}`,
      );
      const list = data.config?.items;
      setItems(Array.isArray(list) ? list : []);
      setSource(String(data.source || ""));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [scopeUserId]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await adminJson("/api/admin/watchlist", {
        method: "POST",
        body: JSON.stringify({
          config: { items },
          scopeUserId: scopeUserId || null,
        }),
      });
      setMsg("Watchlist saved.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetScope() {
    if (!confirm("Reset watchlist for this scope?")) return;
    setSaving(true);
    try {
      const q = scopeUserId ? `?scopeUserId=${encodeURIComponent(scopeUserId)}` : "";
      await adminJson(`/api/admin/watchlist${q}`, { method: "DELETE" });
      setMsg("Reset.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h2 className="text-lg font-semibold text-slate-900">Watchlist</h2>
      <p className="mt-1 text-sm text-slate-600">
        Symbols and prices for the in-app watchlist. Optional per-user overrides via scope.
      </p>
      {source ? <p className="mt-2 text-xs text-slate-500">Source: {source}</p> : null}
      {msg ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900">{err}</p>
      ) : null}

      <div className="mt-6">
        <ScopeUserBar
          scopeUserId={scopeUserId}
          onScopeChange={setScopeUserId}
          onLoad={() => void loadConfig()}
          users={users}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save watchlist"}
        </button>
        <button
          type="button"
          onClick={() => void resetScope()}
          disabled={saving}
          className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-700"
        >
          Reset scope
        </button>
        <button
          type="button"
          onClick={() =>
            setItems((p) => [...p, { symbol: "NEW", name: "", ltp: 0, change: 0, changePct: 0 }])
          }
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm"
        >
          + Row
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">LTP</th>
                <th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Change %</th>
                <th className="px-3 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-28 rounded border border-slate-200 px-2 py-1 font-mono uppercase"
                      value={row.symbol}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((r, i) => (i === idx ? { ...r, symbol: e.target.value } : r)),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1"
                      value={row.name || ""}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.ltp}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, ltp: Number(e.target.value) || 0 } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.change}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, change: Number(e.target.value) || 0 } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="any"
                      className="w-20 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.changePct}
                      onChange={(e) =>
                        setItems((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, changePct: Number(e.target.value) || 0 } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-rose-600 text-xs"
                      onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
