import { NavLink } from "react-router-dom";
import React from "react";
import { useAuthState } from "../hooks/useAuthState";
import {
  LayoutDashboard,
  CandlestickChart,
  BarChart3,
  Sparkles,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { to: "/trades", label: "Trades", icon: <CandlestickChart size={18} /> },
  { to: "/analysis", label: "Analysis", icon: <BarChart3 size={18} /> },
  { to: "/insights", label: "Insights", icon: <Sparkles size={18} /> },
];

function NavRow({ to, label, icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
          "text-sm font-medium",
          "hover:bg-slate-100 dark:hover:bg-zinc-900/60",
          isActive
            ? "bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900/40"
            : "text-slate-700 dark:text-zinc-200",
        ].join(" ")
      }
    >
      <span
        className={[
          "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full transition-opacity",
          "bg-sky-500",
          "opacity-0 group-[.active]:opacity-100",
        ].join(" ")}
      />

      <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <span className="text-base leading-none">{icon}</span>
      </span>

      <span className="flex-1">{label === "Home" ? "Dashboard" : label}</span>

      <span className="h-2 w-2 rounded-full bg-sky-500 opacity-0 transition-opacity group-[.active]:opacity-100" />
    </NavLink>
  );
}

function MobileNavItem({ to, label, icon }: NavItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex flex-1 flex-col items-center justify-center gap-1 py-2",
          "text-[10px] font-semibold tracking-wide",
          isActive ? "text-sky-500" : "text-zinc-500",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              "grid h-9 w-9 place-items-center rounded-xl transition",
              isActive ? "text-sky-500" : "text-zinc-400",
            ].join(" ")}
          >
            <span className="text-lg leading-none">{icon}</span>
          </div>

          <div className="uppercase">{label}</div>

          <div
            className={[
              "h-1 w-1 rounded-full transition-opacity",
              isActive ? "opacity-100 bg-sky-500" : "opacity-0",
            ].join(" ")}
          />
        </>
      )}
    </NavLink>
  );
}

export default function AppSidebar() {
  const { user } = useAuthState();

  return (
    <>
      {/* =========================
          DESKTOP SIDEBAR (md+)
      ========================= */}
      <aside className="hidden md:block sticky top-0 h-screen w-72 border-r border-slate-200 bg-white dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex h-full flex-col px-4 py-4 overflow-hidden">
          {/* Brand */}
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl  bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <img
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="TradeXVault"
                className="h-10 w-auto drop-shadow-md"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-slate-900 dark:text-white">
                TradeXVault
              </div>
            </div>
          </div>

          {/* ===== User Card ===== */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-white text-xl font-bold">
                {(user?.email?.[0] || "U").toUpperCase()}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-black" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  {(user?.email || "User").split("@")[0]}
                </div>

                <div className="truncate text-xs text-zinc-400">
                  {user?.email}
                </div>
              </div>
            </div>
          </div>

          {/* Menu label */}
          <div className="mt-6 flex-1 overflow-y-auto">
            <div className="px-2 text-[11px] font-semibold tracking-widest text-slate-400 dark:text-zinc-500">
              MENU
            </div>

            <nav className="mt-2 flex flex-col gap-1">
              {navItems.map((it) => (
                <NavRow key={it.to} {...it} />
              ))}
            </nav>
          </div>
        </div>
      </aside>

      {/* =========================
          MOBILE BOTTOM NAV (<md)
      ========================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30">
        <div className="mx-auto max-w-md">
          <div className="border-t border-white/10 bg-zinc-950/85 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
              {navItems.map((it) => (
                <MobileNavItem key={it.to} {...it} />
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
