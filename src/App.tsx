import {
  HashRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import TradeForm from "./pages/TradeForm";
import AppSidebar from "./components/AppSidebar";
import Analysis from "./pages/Analysis";
import { useAuthState } from "./hooks/useAuthState";
import type { JSX } from "react";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

/* =========================
   Layout / Shell
========================= */

function usePageTitle(pathname: string) {
  return useMemo(() => {
    if (pathname === "/" || pathname === "") return "Dashboard";
    const p = pathname.replace("/", "");
    if (p.startsWith("trades")) return "Trades";
    if (p.startsWith("analysis")) return "Analysis";
    if (p.startsWith("dashboard")) return "Dashboard";
    return p.charAt(0).toUpperCase() + p.slice(1);
  }, [pathname]);
}

function formatTopDate(d = new Date()) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useAuthState();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const title = usePageTitle(pathname);
  const dateText = useMemo(() => formatTopDate(), []);
  const [openMenu, setOpenMenu] = useState(false);

  const onLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".profile-menu")) {
        setOpenMenu(false);
      }
    }

    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenu]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex min-h-screen">
        {/* ✅ IMPORTANT: Render AppSidebar ALWAYS (desktop sidebar + mobile bottom nav) */}
        <AppSidebar />

        {/* RIGHT: Navbar + Page */}
        <div className="min-w-0 flex-1">
          {/* =========================
            DESKTOP NAVBAR (md+)
          ========================= */}
          <header className="hidden md:block sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-zinc-900 dark:bg-zinc-950/80">
            <div className="flex items-center gap-4 px-4 py-3">
              {/* Left: Title + date */}
              <div className="min-w-[220px]">
                <div className="text-xl font-semibold leading-none">
                  {title}
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  {dateText}
                </div>
              </div>

              {/* Center: Search */}
              <div className="flex flex-1">
                <div className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <span className="text-slate-400 dark:text-zinc-500">⌕</span>
                  <input
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                    placeholder="Search..."
                  />
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                    Ctrl+K
                  </span>
                </div>
              </div>

              {/* Right: Profile only */}
              <div className="ml-auto flex items-center gap-0">
                <div className="flex items-center gap-0 rounded-xl border border-slate-200 bg-white px-0 py-0 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="relative profile-menu">
                    <button
                      onClick={() => setOpenMenu((prev) => !prev)}
                      className="flex items-center gap-2 rounded-xl border border-white/10 px-1.5 py-1.5 text-white font-semibold active:scale-95 transition"
                      aria-label="Open profile menu"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-md text-xl bg-emerald-700">
                        {(user?.email?.[0] || "S").toUpperCase()}
                      </span>

                      <span
                        className={`text-xs transition ${openMenu ? "rotate-180" : ""}`}
                      >
                        ▾
                      </span>
                    </button>

                    {openMenu && (
                      <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur">
                        <div className="text-sm font-semibold text-white truncate">
                          {user?.email}
                        </div>

                        <div className="mt-3 h-px bg-white/10" />

                        <button
                          onClick={onLogout}
                          className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* =========================
            MOBILE TOP HEADER (<md)
          ========================= */}
          <header className="md:hidden sticky top-0 z-30 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Left: Logo + Title */}
              <div className="flex items-center gap-3">
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="TradeXVault"
                  className="h-9 w-auto drop-shadow-md"
                />
                <div className="text-lg font-semibold text-white">{title}</div>
              </div>

              {/* Right: Profile */}
              <div className="flex items-center gap-3">
                <div className="relative profile-menu">
                  <button
                    onClick={() => setOpenMenu((prev) => !prev)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 px-1.5 py-1.5 text-white font-semibold active:scale-95 transition"
                    aria-label="Open profile menu"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md text-xl bg-emerald-700">
                      {(user?.email?.[0] || "S").toUpperCase()}
                    </span>

                    <span
                      className={`text-xs transition ${openMenu ? "rotate-180" : ""}`}
                    >
                      ▾
                    </span>
                  </button>

                  {openMenu && (
                    <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur">
                      <div className="text-sm font-semibold text-white truncate">
                        {user?.email}
                      </div>

                      <div className="mt-3 h-px bg-white/10" />

                      <button
                        onClick={onLogout}
                        className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* ✅ IMPORTANT: pb-24 on mobile so bottom nav NEVER covers content */}
          <main className="min-w-0 p-4 md:p-6 pb-24 md:pb-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Routes
========================= */

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuthState();
  if (loading)
    return (
      <div className="p-4 text-slate-500 dark:text-zinc-400">Loading...</div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | null;

  return (
    <>
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/login" element={<Login />} />

        <Route
          path="/*"
          element={
            <PrivateRoute>
              <Shell>
                <Routes>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="trades" element={<Trades />} />
                  <Route path="analysis" element={<Analysis />} />
                  <Route index element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Shell>
            </PrivateRoute>
          }
        />
      </Routes>

      {/* Modal routes (always rendered on top) */}
      {state?.backgroundLocation && (
        <Routes>
          <Route
            path="/new"
            element={
              <PrivateRoute>
                <TradeForm mode="create" />
              </PrivateRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <PrivateRoute>
                <TradeForm mode="edit" />
              </PrivateRoute>
            }
          />
        </Routes>
      )}

      {/* If user opens /new directly (no backgroundLocation), still render it */}
      {!state?.backgroundLocation && (
        <Routes>
          <Route
            path="/new"
            element={
              <PrivateRoute>
                <Shell>
                  <TradeForm mode="create" />
                </Shell>
              </PrivateRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <PrivateRoute>
                <Shell>
                  <TradeForm mode="edit" />
                </Shell>
              </PrivateRoute>
            }
          />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
