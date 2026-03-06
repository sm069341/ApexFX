import { useEffect, useMemo, useState } from "react";
import { collection, orderBy, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import type { Trade } from "../types";
import { money } from "../lib/format";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import TradesSkeleton from "../components/TradesSkeleton";

/* ---------- helpers ---------- */
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDatePro(dateStr: string) {
  if (!dateStr) return "-";

  const date = new Date(dateStr);

  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(2);

  return `${day} ${month} '${year}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatPrice(symbol: string, price: any) {
  const n = Number(price);
  if (!Number.isFinite(n)) return "-";

  const s = (symbol || "").toUpperCase();

  // JPY pairs
  if (s.endsWith("JPY")) return n.toFixed(3);

  // Metals
  if (s.includes("XAU") || s.includes("XAG")) return n.toFixed(2);

  // Crypto
  if (s.includes("BTC") || s.includes("ETH") || s.includes("USDT")) return n.toFixed(2);

  // Default forex
  return n.toFixed(5);
}

export default function Trades() {
  const { user } = useAuthState();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const location = useLocation();

  /* ---------- filters (working) ---------- */
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [symbol, setSymbol] = useState("");
  const [plFilter, setPlFilter] = useState<"ALL" | "PROFIT" | "LOSS">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");

  const [period, setPeriod] = useState<
    "ALL" | "TODAY" | "WEEK" | "MONTH" | "LAST_MONTH" | "LAST_3" | "CUSTOM"
  >("ALL");

  // custom date range
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // apply quick time period -> from/to
  useEffect(() => {
    if (period === "CUSTOM") return;

    const now = new Date();
    let f = "";
    let t = "";

    if (period === "ALL") {
      f = "";
      t = "";
    } else if (period === "TODAY") {
      f = ymd(now);
      t = ymd(now);
    } else if (period === "WEEK") {
      f = ymd(startOfWeek(now));
      t = ymd(now);
    } else if (period === "MONTH") {
      f = ymd(startOfMonth(now));
      t = ymd(now);
    } else if (period === "LAST_MONTH") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      f = ymd(startOfMonth(prev));
      t = ymd(endOfMonth(prev));
    } else if (period === "LAST_3") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      f = ymd(startOfMonth(start));
      t = ymd(now);
    }

    setFrom(f);
    setTo(t);
  }, [period]);

  const clearAll = () => {
    setSymbol("");
    setPlFilter("ALL");
    setTypeFilter("ALL");
    setPeriod("ALL");
    setFrom("");
    setTo("");
  };

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const q = query(
      collection(db, "trades"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as any[];

        setTrades(rows as any);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load trades:", err);
        alert("Failed to load trades. Open console (F12) to see the error.");
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user]);

  /* ---------- filtered list ---------- */
  const filtered = useMemo(() => {
    const sym = symbol.trim().toLowerCase();

    return (trades || []).filter((t: any) => {
      const symOk = sym ? (t.symbol || "").toLowerCase().includes(sym) : true;

      // Type filter like screenshot (Long/Short)
      // Mapping: BUY = Long, SELL = Short
      const typeOk =
        typeFilter === "ALL"
          ? true
          : typeFilter === "LONG"
            ? t.side === "BUY"
            : t.side === "SELL";

      // P&L filter
      const plOk =
        plFilter === "ALL"
          ? true
          : plFilter === "PROFIT"
            ? Number(t.pnl || 0) > 0
            : Number(t.pnl || 0) < 0;

      // Date range filter (entryDate string YYYY-MM-DD)
      const d = (t.entryDate || "") as string;
      const fromOk = from ? d >= from : true;
      const toOk = to ? d <= to : true;

      return symOk && typeOk && plOk && fromOk && toOk;
    });
  }, [trades, symbol, typeFilter, plFilter, from, to]);

  // /* ---------- counts for chips ---------- */
  // const profitCount = useMemo(() => filtered.filter((x: any) => Number(x.pnl) > 0).length, [filtered]);
  // const lossCount = useMemo(() => filtered.filter((x: any) => Number(x.pnl) < 0).length, [filtered]);

  /* ---------- filters Page (working) ---------- */
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  }, [filtered.length]);
  // Clamp page if filters reduce results
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  // Reset to page 1 whenever filters change (so user doesn't land on empty page)
  useEffect(() => {
    setPage(1);
  }, [symbol, typeFilter, plFilter, from, to, period]);
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  if (loading) return <TradesSkeleton />;

  return (
    <div className="space-y-5">
      {/* Page header like screenshot */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold text-white">Trades</div>
          <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            Not connected
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
          {/* <button className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700">
            Connect MT4/MT5
          </button> */}

          <Link
            to="/new"
            state={{ backgroundLocation: location }}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            + Add Trade
          </Link>
        </div>
      </div>

      {/* Trade history panel */}
      <div className="rounded-3xl border border-white/10 bg-zinc-950/40 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <History
                size={20}
                strokeWidth={2.6}
                className="text-sky-400 shrink-0"
              />
              <span>Trade History</span>
            </div>
            <div className="text-sm text-zinc-500">
              {filtered.length} of {trades.length} trades • Page {page} of{" "}
              {totalPages}
            </div>
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10"
          >
            <span className="text-zinc-300">⎇</span>
            Filters
            <span className="ml-1 h-2 w-2 rounded-full bg-sky-500" />
          </button>
        </div>

        {/* FILTER PANEL (exact like screenshot) */}
        {filtersOpen && (
          <div className="px-6 pt-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-4">
                {/* Row 1: P&L + TYPE */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* P&L segmented */}
                  <div className="grid grid-cols-[40px_1fr] items-center gap-2 md:flex md:items-center md:gap-3">
                    {/* Label */}
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase md:w-24">
                      P&L
                    </div>

                    {/* Segmented control */}
                    <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 p-1">
                      <button
                        onClick={() => setPlFilter("ALL")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          plFilter === "ALL"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        All
                      </button>

                      <button
                        onClick={() => setPlFilter("PROFIT")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          plFilter === "PROFIT"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        Profit
                      </button>

                      <button
                        onClick={() => setPlFilter("LOSS")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          plFilter === "LOSS"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        Loss
                      </button>
                    </div>
                  </div>

                  {/* TYPE segmented */}
                  <div className="grid grid-cols-[40px_1fr] items-center gap-2 md:flex md:items-center md:gap-3">
                    {/* Label */}
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-500 uppercase md:w-24">
                      TYPE
                    </div>

                    {/* Segmented control */}
                    <div className="flex items-center rounded-2xl border border-white/10 bg-black/20 p-1">
                      <button
                        onClick={() => setTypeFilter("ALL")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          typeFilter === "ALL"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        All
                      </button>

                      <button
                        onClick={() => setTypeFilter("LONG")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          typeFilter === "LONG"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        Long
                      </button>

                      <button
                        onClick={() => setTypeFilter("SHORT")}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold",
                          typeFilter === "SHORT"
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        Short
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 2: TIME PERIOD chips */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="w-32 text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
                    TIME PERIOD
                  </div>

                  <div className="flex flex-wrap w-full items-center rounded-2xl border border-white/10 bg-black/20 p-1 md:w-auto">
                    {[
                      { k: "ALL", label: "All Time" },
                      { k: "TODAY", label: "Today" },
                      { k: "WEEK", label: "This Week" },
                      { k: "MONTH", label: "This Month" },
                      { k: "LAST_MONTH", label: "Last Month" },
                      { k: "LAST_3", label: "Last 3 Months" },
                    ].map((x) => (
                      <button
                        key={x.k}
                        onClick={() => setPeriod(x.k as any)}
                        className={[
                          "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold whitespace-nowrap",
                          period === x.k
                            ? "bg-blue-600 text-white"
                            : "text-zinc-400 hover:bg-white/5",
                        ].join(" ")}
                      >
                        {x.label}
                      </button>
                    ))}

                    <button
                      onClick={() => setPeriod("CUSTOM")}
                      className={[
                        "flex-1 rounded-xl px-2 py-2 text-[12px] md:px-3 md:text-sm font-semibold whitespace-nowrap",
                        period === "CUSTOM"
                          ? "bg-blue-600 text-white"
                          : "text-zinc-400 hover:bg-white/5",
                      ].join(" ")}
                    >
                      📅 Custom
                    </button>
                  </div>
                </div>

                {/* Row 3: Symbol + Custom range */}
                <div
                  className={[
                    "grid grid-cols-1 gap-3",
                    period === "CUSTOM"
                      ? "md:grid-cols-[1fr_220px_220px]"
                      : "md:grid-cols-1",
                  ].join(" ")}
                >
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="Search symbol…"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20"
                  />

                  {period === "CUSTOM" ? (
                    <>
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => {
                          setPeriod("CUSTOM");
                          setFrom(e.target.value);
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                      />

                      <input
                        type="date"
                        value={to}
                        onChange={(e) => {
                          setPeriod("CUSTOM");
                          setTo(e.target.value);
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-white/20"
                      />
                    </>
                  ) : null}
                </div>

                {/* Clear all */}
                <div className="flex justify-end">
                  <button
                    onClick={clearAll}
                    className="rounded-2xl border border-white/10 bg-black/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5"
                  >
                    ✕ Clear All Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TABLE HEADER + ROWS */}
        <div className="mt-6 px-3 pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="text-5xl text-zinc-700">⎇</div>
              <div className="text-sm text-zinc-500">
                No trades match your filters
              </div>
              <button
                onClick={clearAll}
                className="rounded-xl border border-white/10 bg-zinc-950/30 px-5 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/40"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* =========================
        MOBILE (exact accordion UI)
        ========================= */}
              <div className="sm:hidden space-y-3">
                {pageItems.map((t: any) => {
                  const isOpen = openId === t.id;
                  const isLong = t.side === "BUY";
                  const pnl = Number(t.pnl || 0);

                  return (
                    <div
                      key={t.id}
                      className="rounded-3xl border border-white/10 bg-zinc-950/40 shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden"
                    >
                      {/* header row */}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenId((cur) => (cur === t.id ? null : t.id))
                        }
                        className="w-full px-4 py-4"
                      >
                        <div className="grid grid-cols-[92px_64px_1fr] items-center gap-2">
                          {/* Col 1 — Pair (fixed width so chip lines up perfectly) */}
                          <div className="text-sm font-semibold text-white text-center">
                            {t.symbol}
                          </div>

                          {/* Col 2 — Long/Short (fixed width, always same position) */}
                          <span
                            className={[
                              "justify-self-center w-[64px] text-center rounded-full border px-2 py-1",
                              "text-[11px] font-bold leading-none whitespace-nowrap",
                              isLong
                                ? "border-sky-500/20 bg-green-500/10 text-green-300"
                                : "border-rose-500/20 bg-rose-500/10 text-rose-300",
                            ].join(" ")}
                          >
                            {isLong ? "BUY" : "SELL"}
                          </span>

                          {/* Col 3 — P&L + arrow pinned right */}
                          <div className="flex items-center justify-end gap-2">
                            <div
                              className={[
                                "text-sm font-semibold tabular-nums whitespace-nowrap",
                                pnl >= 0 ? "text-green-500" : "text-rose-500",
                              ].join(" ")}
                            >
                              {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                            </div>

                            <span
                              className={[
                                "text-zinc-500 transition-transform",
                                isOpen ? "rotate-180" : "",
                              ].join(" ")}
                            >
                              ▾
                            </span>
                          </div>
                        </div>
                      </button>

                      {/* expanded panel */}
                      {isOpen ? (
                        <div className="px-4 pb-4">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="grid grid-cols-2 gap-y-3 text-sm">
                              <div className="text-zinc-500">Date</div>
                              <div className="text-right text-zinc-500 tabular-nums">
                                {formatDatePro(t.entryDate)}
                              </div>

                              <div className="text-zinc-500">Session</div>
                              <div className="text-right text-zinc-200 tabular-nums">
                                {t.session ?? "-"}
                              </div>

                              <div className="text-zinc-500">Entry</div>
                              <div className="text-right text-zinc-200 tabular-nums">
                                {t.entryPrice != null
                                  ? formatPrice(t.symbol, t.entryPrice)
                                  : "-"}
                              </div>

                              <div className="text-zinc-500">Exit</div>
                              <div className="text-right text-zinc-200 tabular-nums">
                                {t.exitPrice != null &&
                                Number(t.exitPrice) !== 0
                                  ? formatPrice(t.symbol, t.exitPrice)
                                  : "-"}
                              </div>

                              <div className="text-zinc-500">Size</div>
                              <div className="text-right text-zinc-200 tabular-nums">
                                {t.quantity != null
                                  ? `${Number(t.quantity).toFixed(2)}`
                                  : "-"}
                              </div>

                              <div className="text-zinc-500">Tags</div>
                              <div className="text-right text-zinc-200">
                                {Array.isArray(t.tags) && t.tags.length
                                  ? t.tags.join(", ")
                                  : "-"}
                              </div>

                              {/* <div className="text-zinc-500">Source</div>
                    <div className="flex justify-end">
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300">
                        {t.source ?? "Manual"}
                      </span>
                    </div> */}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* =========================
        DESKTOP (your existing table, unchanged)
        ========================= */}
              <div className="hidden sm:block mt-2 overflow-x-auto overflow-y-hidden [scrollbar-color:rgba(255,255,255,0.18)_transparent]">
                <div className="min-w-[1110px]">
                  {/* Header */}
                  <div className="grid grid-cols-[160px_140px_120px_120px_140px_140px_140px_140px] border-b border-white/10 pb-3 text-[11px] font-semibold tracking-[0.18em] text-zinc-500">
                    <div className="px-2 uppercase">DATE</div>
                    <div className="px-2 uppercase">SYMBOL</div>
                    <div className="px-2 uppercase">SESSION</div>
                    <div className="px-2 uppercase">TYPE</div>
                    <div className="px-2 uppercase">ENTRY</div>
                    <div className="px-2 uppercase">EXIT</div>
                    <div className="px-2 uppercase">QUANTITY</div>
                    <div className="px-2 text-right uppercase">P&amp;L</div>
                    <div className="px-2 uppercase">TAGS</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-white/10">
                    {pageItems.map((t: any) => (
                      <div
                        key={t.id}
                        className="grid grid-cols-[160px_140px_120px_120px_140px_140px_140px_140px] items-center py-6 text-sm text-zinc-200 hover:bg-white/5 cursor-pointer"
                      >
                        <div className="px-2 whitespace-nowrap text-zinc-400">
                          {formatDatePro(t.entryDate)}
                        </div>
                        <div className="px-2 whitespace-nowrap font-semibold text-white">
                          {t.symbol}
                        </div>
                        <div className="px-2 whitespace-nowrap text-zinc-200">
                          {t.session ?? "-"}
                        </div>

                        <div className="px-2 whitespace-nowrap">
                          <span
                            className={[
                              "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-bold",
                              t.side === "BUY"
                                ? "border-green-900/60 bg-green-900/20 text-green-300"
                                : "border-rose-900/60 bg-rose-900/20 text-rose-300",
                            ].join(" ")}
                          >
                            <span className="inline-flex items-center gap-1">
                              {t.side === "BUY" ? (
                                <>
                                  <ArrowUpRight size={14} />
                                  BUY
                                </>
                              ) : (
                                <>
                                  <ArrowDownRight size={14} />
                                  SELL
                                </>
                              )}
                            </span>
                          </span>
                        </div>

                        <div className="px-2 whitespace-nowrap text-zinc-200">
                          {t.entryPrice != null
                            ? formatPrice(t.symbol, t.entryPrice)
                            : "-"}
                        </div>

                        <div className="px-2 whitespace-nowrap text-zinc-200">
                          {t.exitPrice != null && Number(t.exitPrice) !== 0
                            ? formatPrice(t.symbol, t.exitPrice)
                            : "-"}
                        </div>

                        <div className="px-2 whitespace-nowrap text-zinc-200">
                          {t.quantity != null
                            ? `${Number(t.quantity).toFixed(2)}`
                            : "-"}
                        </div>

                        <div
                          className={[
                            "px-2 whitespace-nowrap text-right font-semibold",
                            Number(t.pnl) >= 0
                              ? "text-green-500"
                              : "text-red-500",
                          ].join(" ")}
                        >
                          {Number(t.pnl) >= 0 ? "+" : "-"}
                          {money(Math.abs(Number(t.pnl) || 0))}
                        </div>

                        <div className="px-2 text-zinc-200 truncate">
                          {Array.isArray(t.tags) && t.tags.length
                            ? t.tags.join(", ")
                            : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {filtered.length > 0 && totalPages > 1 ? (
                  <div className="mt-5 flex items-center justify-between px-3">
                    <div className="text-sm text-zinc-500">
                      Showing {(page - 1) * PAGE_SIZE + 1}–
                      {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                      {filtered.length}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className={[
                          "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold",
                          page === 1
                            ? "text-zinc-600 cursor-not-allowed"
                            : "text-zinc-200 hover:bg-white/10",
                        ].join(" ")}
                      >
                        ← Prev
                      </button>

                      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 tabular-nums">
                        {page}/{totalPages}
                      </div>

                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className={[
                          "rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold",
                          page === totalPages
                            ? "text-zinc-600 cursor-not-allowed"
                            : "text-zinc-200 hover:bg-white/10",
                        ].join(" ")}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
