"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/components/admin/adminFetch";

type User = {
  _id: string;
  fullName?: string;
  clientId?: string;
  email?: string;
  phone?: string;
  status?: string;
  tradingBalance?: number;
  margin?: number;
  adminPlainPassword?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [clientIdDrafts, setClientIdDrafts] = useState<Record<string, string>>({});
  const [balanceDrafts, setBalanceDrafts] = useState<Record<string, string>>({});
  const [marginDrafts, setMarginDrafts] = useState<Record<string, string>>({});
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail] = useState<Record<string, boolean>>({});
  const [activating, setActivating] = useState<Record<string, boolean>>({});
  const [resending, setResending] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await adminJson<{ users: User[] }>("/api/admin/users");
      setUsers(data.users || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createClient() {
    setMsg(null);
    setErr(null);
    setCreating(true);
    try {
      await adminJson("/api/admin/create-client", {
        method: "POST",
        body: JSON.stringify({
          fullName: newName.trim(),
          clientId: newClientId.trim(),
          password: newPassword,
        }),
      });
      setMsg("Client created.");
      setNewName("");
      setNewClientId("");
      setNewPassword("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function activateUser(userId: string) {
    setMsg(null);
    setErr(null);
    const password = (passwordDrafts[userId] || "").trim();
    const clientId = (clientIdDrafts[userId] || "").trim();
    if (!clientId && !password) {
      setErr("Enter at least a Client ID or password");
      return;
    }
    if (!password) {
      setErr("Enter a password");
      return;
    }
    setActivating((p) => ({ ...p, [userId]: true }));
    try {
      const data = await adminJson<{
        email?: string;
        clientId?: string;
        emailSent?: boolean;
        emailWarning?: string | null;
      }>("/api/admin/generate-password", {
        method: "POST",
        body: JSON.stringify({ userId, password, clientId: clientId || undefined }),
      });
      setMsg(
        data.emailSent
          ? `Credentials emailed to ${data.email || "user"}. Client ID: ${data.clientId || "—"}`
          : `${data.emailWarning || "Saved, but email could not be sent."} Client ID: ${data.clientId || "—"}`,
      );
      setPasswordDrafts((p) => ({ ...p, [userId]: "" }));
      setClientIdDrafts((p) => ({ ...p, [userId]: "" }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setActivating((p) => ({ ...p, [userId]: false }));
    }
  }

  async function setBalanceMargin(userId: string) {
    setMsg(null);
    setErr(null);
    const tb = (balanceDrafts[userId] || "").trim();
    const mg = (marginDrafts[userId] || "").trim();
    const payload: Record<string, unknown> = { userId };
    if (tb !== "") {
      const n = Number(tb);
      if (!Number.isFinite(n)) {
        setErr("Invalid trading balance");
        return;
      }
      payload.tradingBalance = n;
    }
    if (mg !== "") {
      const n = Number(mg);
      if (!Number.isFinite(n)) {
        setErr("Invalid margin");
        return;
      }
      payload.margin = n;
    }
    try {
      await adminJson("/api/admin/users", { method: "POST", body: JSON.stringify(payload) });
      setMsg("Balance / margin updated.");
      setBalanceDrafts((p) => ({ ...p, [userId]: "" }));
      setMarginDrafts((p) => ({ ...p, [userId]: "" }));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  async function resendCredentials(userId: string) {
    setMsg(null);
    setErr(null);
    setResending((p) => ({ ...p, [userId]: true }));
    try {
      const data = await adminJson<{ email?: string }>("/api/admin/resend-credentials", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      setMsg(`Credentials resent to ${data.email || "user"}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to resend");
    } finally {
      setResending((p) => ({ ...p, [userId]: false }));
    }
  }

  async function saveEmail(userId: string) {
    setMsg(null);
    setErr(null);
    const email = (emailDrafts[userId] ?? "").trim();
    if (!email) {
      setErr("Enter an email address");
      return;
    }
    setSavingEmail((p) => ({ ...p, [userId]: true }));
    try {
      await adminJson("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ userId, email }),
      });
      setMsg("Email updated.");
      setEmailDrafts((p) => {
        const next = { ...p };
        delete next[userId];
        return next;
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to update email");
    } finally {
      setSavingEmail((p) => ({ ...p, [userId]: false }));
    }
  }

  async function blockToggle(userId: string, block: boolean) {
    setMsg(null);
    setErr(null);
    try {
      await adminJson("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ userId, status: block ? "blocked" : "active" }),
      });
      setMsg(block ? "User blocked." : "User activated.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h2 className="text-lg font-semibold text-slate-900">Users &amp; clients</h2>
      <p className="mt-1 text-sm text-slate-600">
        Assign Client ID &amp; password in one step — credentials are emailed automatically.
      </p>

      {msg ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}
      {err ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-900">{err}</p>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-medium text-slate-900">Create client</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Client ID"
            value={newClientId}
            onChange={(e) => setNewClientId(e.target.value)}
          />
          <input
            type="password"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void createClient()}
          disabled={creating}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create client"}
        </button>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-medium text-slate-900">All users</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Client ID</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Password</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Balance</th>
                <th className="px-3 py-3 text-right">Margin</th>
                <th className="px-3 py-3">Set credentials</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const busy = !!activating[u._id];
                  return (
                    <tr key={u._id} className="border-b border-slate-50 hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <Link
                          href={`/admin/user-details?id=${u._id}`}
                          className="text-emerald-600 hover:underline"
                        >
                          {u.fullName || "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{u.clientId || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[200px] items-center gap-1">
                          <input
                            type="email"
                            className="w-40 rounded border border-slate-200 px-2 py-1 text-xs text-slate-800"
                            placeholder="Email"
                            value={emailDrafts[u._id] ?? u.email ?? ""}
                            onChange={(e) =>
                              setEmailDrafts((p) => ({ ...p, [u._id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            disabled={
                              !!savingEmail[u._id] ||
                              (emailDrafts[u._id] ?? u.email ?? "") === (u.email || "")
                            }
                            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-40"
                            onClick={() => void saveEmail(u._id)}
                          >
                            {savingEmail[u._id] ? "…" : "Save"}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">
                        {u.adminPlainPassword || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.status === "active"
                              ? "bg-emerald-100 text-emerald-800"
                              : u.status === "blocked"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {u.status || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                        {u.tradingBalance ?? 0}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-800">
                        {u.margin ?? 0}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="Client ID"
                            value={clientIdDrafts[u._id] ?? ""}
                            onChange={(e) =>
                              setClientIdDrafts((p) => ({ ...p, [u._id]: e.target.value }))
                            }
                          />
                          <input
                            type="password"
                            className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                            placeholder="Password"
                            value={passwordDrafts[u._id] ?? ""}
                            onChange={(e) =>
                              setPasswordDrafts((p) => ({ ...p, [u._id]: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            disabled={busy}
                            className="whitespace-nowrap rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            onClick={() => void activateUser(u._id)}
                          >
                            {busy ? "…" : "Activate & Email"}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <input
                              className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                              placeholder="Bal"
                              value={balanceDrafts[u._id] ?? ""}
                              onChange={(e) =>
                                setBalanceDrafts((p) => ({ ...p, [u._id]: e.target.value }))
                              }
                            />
                            <input
                              className="w-16 rounded border border-slate-200 px-1 py-0.5 text-xs"
                              placeholder="Marg"
                              value={marginDrafts[u._id] ?? ""}
                              onChange={(e) =>
                                setMarginDrafts((p) => ({ ...p, [u._id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white"
                              onClick={() => void setBalanceMargin(u._id)}
                            >
                              Apply
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800"
                              onClick={() => void blockToggle(u._id, true)}
                            >
                              Block
                            </button>
                            <button
                              type="button"
                              className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                              onClick={() => void blockToggle(u._id, false)}
                            >
                              Unblock
                            </button>
                            <button
                              type="button"
                              disabled={!!resending[u._id] || !u.clientId || !u.adminPlainPassword}
                              className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800 disabled:opacity-50"
                              onClick={() => void resendCredentials(u._id)}
                            >
                              {resending[u._id] ? "Sending…" : "Resend Mail"}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
