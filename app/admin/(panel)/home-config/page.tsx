"use client";

import { useCallback, useEffect, useState } from "react";
import { adminJson } from "@/components/admin/adminFetch";
import { ScopeUserBar } from "@/components/admin/ScopeUserBar";

type HomeIndex = {
  name: string;
  value: number;
  change: number;
  changePct: number;
  tvSymbol?: string;
};
type HomeStock = {
  symbol: string;
  name?: string;
  ltp: number;
  change: number;
  changePct: number;
};
type UserOpt = { _id: string; clientId?: string; email?: string; fullName?: string };

export default function AdminHomeConfigPage() {
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [scopeUserId, setScopeUserId] = useState("");
  const [indices, setIndices] = useState<HomeIndex[]>([]);
  const [stocks, setStocks] = useState<HomeStock[]>([]);
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
      const data = await adminJson<{ config?: { indices?: HomeIndex[]; stocks?: HomeStock[] }; source?: string }>(
        `/api/admin/dashboard-home${q}`,
      );
      const cfg = data.config || {};
      setIndices(Array.isArray(cfg.indices) ? cfg.indices : []);
      setStocks(Array.isArray(cfg.stocks) ? cfg.stocks : []);
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
      await adminJson("/api/admin/dashboard-home", {
        method: "POST",
        body: JSON.stringify({
          config: { indices, stocks },
          scopeUserId: scopeUserId || null,
        }),
      });
      setMsg("Home config saved.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function resetScope() {
    if (!confirm("Reset config for this scope to defaults?")) return;
    setSaving(true);
    setErr(null);
    try {
      const q = scopeUserId ? `?scopeUserId=${encodeURIComponent(scopeUserId)}` : "";
      await adminJson(`/api/admin/dashboard-home${q}`, { method: "DELETE" });
      setMsg("Reset.");
      await loadConfig();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  function addIndex() {
    setIndices((prev) => [
      ...prev,
      { name: "BANK NIFTY", value: 48000, change: 0, changePct: 0, tvSymbol: "NSE:BANKNIFTY" },
    ]);
  }
  function addStock() {
    setStocks((prev) => [...prev, { symbol: "RELIANCE", name: "Reliance", ltp: 0, change: 0, changePct: 0 }]);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h2 className="text-lg font-semibold text-slate-900">Home &amp; indices</h2>
      <p className="mt-1 text-sm text-slate-600">
        Data shown on the mobile app home (index strip + featured stocks). Use{" "}
        <code className="rounded bg-slate-100 px-1">tvSymbol</code> for TradingView (e.g.{" "}
        <code className="rounded bg-slate-100 px-1">NSE:NIFTY</code>).
      </p>
      {source ? (
        <p className="mt-2 text-xs text-slate-500">Config source: {source}</p>
      ) : null}
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
          {saving ? "Saving…" : "Save home config"}
        </button>
        <button
          type="button"
          onClick={() => void resetScope()}
          disabled={saving}
          className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
        >
          Reset scope
        </button>
        <button type="button" onClick={addIndex} className="rounded-lg bg-slate-100 px-4 py-2 text-sm">
          + Index row
        </button>
        <button type="button" onClick={addStock} className="rounded-lg bg-slate-100 px-4 py-2 text-sm">
          + Stock row
        </button>
      </div>

      <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">Indices</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Change %</th>
                <th className="px-3 py-2">tvSymbol</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {indices.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded border border-slate-200 px-2 py-1"
                      value={row.name}
                      onChange={(e) =>
                        setIndices((p) =>
                          p.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-28 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.value}
                      onChange={(e) =>
                        setIndices((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, value: Number(e.target.value) || 0 } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.change}
                      onChange={(e) =>
                        setIndices((p) =>
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
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-right"
                      value={row.changePct}
                      onChange={(e) =>
                        setIndices((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, changePct: Number(e.target.value) || 0 } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                      value={row.tvSymbol || ""}
                      placeholder="NSE:NIFTY"
                      onChange={(e) =>
                        setIndices((p) =>
                          p.map((r, i) =>
                            i === idx ? { ...r, tvSymbol: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-rose-600 text-xs hover:underline"
                      onClick={() => setIndices((p) => p.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2 font-medium text-slate-800">Featured stocks</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-3 py-2">Symbol</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">LTP</th>
                <th className="px-3 py-2">Change</th>
                <th className="px-3 py-2">Change %</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {stocks.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="px-3 py-2">
                    <input
                      className="w-28 rounded border border-slate-200 px-2 py-1 font-mono uppercase"
                      value={row.symbol}
                      onChange={(e) =>
                        setStocks((p) =>
                          p.map((r, i) => (i === idx ? { ...r, symbol: e.target.value } : r)),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1"
                      value={row.name || ""}
                      onChange={(e) =>
                        setStocks((p) =>
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
                        setStocks((p) =>
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
                        setStocks((p) =>
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
                        setStocks((p) =>
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
                      className="text-rose-600 text-xs hover:underline"
                      onClick={() => setStocks((p) => p.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
