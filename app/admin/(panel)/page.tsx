import Link from "next/link";
import {
  FiUsers,
  FiTrendingUp,
  FiList,
  FiCpu,
  FiDollarSign,
  FiSettings,
} from "react-icons/fi";

const cards = [
  {
    href: "/admin/users",
    title: "Users & clients",
    desc: "Create clients, set passwords, balance, block/unblock.",
    icon: FiUsers,
    color: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    href: "/admin/home-config",
    title: "Home & indices",
    desc: "NIFTY / SENSEX rows and featured stocks for the app home.",
    icon: FiTrendingUp,
    color: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    href: "/admin/watchlist",
    title: "Watchlist",
    desc: "Symbols and LTP shown in user watchlists.",
    icon: FiList,
    color: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    href: "/admin/orders",
    title: "Orders & positions",
    desc: "Open/closed orders, P/L, segments.",
    icon: FiCpu,
    color: "bg-amber-50 text-amber-800 ring-amber-100",
  },
  {
    href: "/admin/funds",
    title: "Fund requests",
    desc: "Approve or reject add/withdraw requests.",
    icon: FiDollarSign,
    color: "bg-teal-50 text-teal-800 ring-teal-100",
  },
  {
    href: "/admin/settings",
    title: "QR & payments",
    desc: "UPI QR URL, bank details, QR image upload.",
    icon: FiSettings,
    color: "bg-slate-100 text-slate-800 ring-slate-200",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-slate-600">
        Choose a section from the sidebar or use the shortcuts below. All data is edited in{" "}
        <strong className="text-slate-800">tables</strong> with explicit save actions.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ href, title, desc, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
          >
            <div
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${color}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-semibold text-slate-900 group-hover:text-emerald-700">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
