"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiHome,
  FiUsers,
  FiTrendingUp,
  FiList,
  FiCpu,
  FiDollarSign,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";

const nav = [
  { href: "/admin", label: "Overview", icon: FiHome },
  { href: "/admin/users", label: "Users & clients", icon: FiUsers },
  { href: "/admin/home-config", label: "Home & indices", icon: FiTrendingUp },
  { href: "/admin/watchlist", label: "Watchlist", icon: FiList },
  { href: "/admin/orders", label: "Orders & positions", icon: FiCpu },
  { href: "/admin/funds", label: "Fund requests", icon: FiDollarSign },
  { href: "/admin/settings", label: "QR & payments", icon: FiSettings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    window.localStorage.removeItem("ajmera_admin_ok");
    window.location.href = "/admin/login";
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Admin
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">Zerodha</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            <FiLogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Control panel</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage users, market data shown in the app, orders, and funds.
          </p>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
