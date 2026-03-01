import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import type { Trade } from "../types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  ClipboardList,
  TrendingUp,
  CalendarDays,
  Trophy,
  Globe,
  ArrowUpDown,
} from "lucide-react";
import { Sigma, Scale, DollarSign, Target } from "lucide-react";

/* =========================
  Helpers
========================= */

type PeriodKey = "today" | "7d" | "30d" | "3m" | "1y" | "all";
type ResultFilter = "all" | "winners" | "losers";

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// function pad2(n: number) {
//   return String(n).padStart(2, "0");
// }
// function ymd(d: Date) {
//   return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// }
function parseYMD(s?: string) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
// function formatMoney(n: number) {
//   const sign = n >= 0 ? "+" : "-";
//   return `${sign}$${Math.abs(n).toFixed(2)}`;
// }
function formatK(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function getDirection(t: any): "Long" | "Short" {
  const s = String(t?.side ?? "").toUpperCase();
  if (s === "LONG") return "Long";
  if (s === "SHORT") return "Short";
  if (s === "BUY") return "Long";
  if (s === "SELL") return "Short";
  // fallback: assume long
  return "Long";
}
function pickDate(t: any): Date | null {
  // prefer entryDate (YYYY-MM-DD). fallback to date (datetime-local) => parse.
  const d1 = parseYMD(t?.entryDate);
  if (d1) return d1;

  const raw = t?.date;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function periodStart(period: PeriodKey) {
  const now = new Date();
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "7d") {
    start.setDate(now.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "30d") {
    start.setDate(now.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "3m") {
    start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (period === "1y") {
    start.setFullYear(now.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return new Date(0); // all
}

/* =========================
  Page
========================= */

export default function Analysis() {
  const { user } = useAuthState();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      setLoading(true);

      // ✅ no index needed
      const q = query(collection(db, "trades"), where("uid", "==", user.uid));
      const snap = await getDocs(q);

      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as any[];

      // sort newest -> oldest (for streaks & UI)
      rows.sort((a, b) => {
        const ad = pickDate(a)?.getTime() ?? 0;
        const bd = pickDate(b)?.getTime() ?? 0;
        if (bd !== ad) return bd - ad;
        const at = a.createdAt?.toMillis?.() ?? 0;
        const bt = b.createdAt?.toMillis?.() ?? 0;
        return bt - at;
      });

      if (alive) {
        setTrades(rows as any);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const filteredTrades = useMemo(() => {
    const start = periodStart(period);
    const now = new Date();

    return (trades as any[]).filter((t) => {
      const d = pickDate(t);
      if (!d) return false;
      if (period !== "all" && (d < start || d > now)) return false;

      const pnl = safeNum(t.pnl);
      if (resultFilter === "winners") return pnl > 0;
      if (resultFilter === "losers") return pnl < 0;
      return true;
    });
  }, [trades, period, resultFilter]);

  const stats = useMemo(() => {
    const rows = filteredTrades as any[];
    const count = rows.length;

    let total = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let wins = 0;
    let losses = 0;

    let best = -Infinity;
    let worst = Infinity;

    const winners: number[] = [];
    const losers: number[] = [];

    for (const t of rows) {
      const pnl = safeNum(t.pnl);
      total += pnl;

      best = Math.max(best, pnl);
      worst = Math.min(worst, pnl);

      if (pnl > 0) {
        wins++;
        grossProfit += pnl;
        winners.push(pnl);
      } else if (pnl < 0) {
        losses++;
        grossLoss += Math.abs(pnl);
        losers.push(pnl);
      }
    }

    const winRate = count ? wins / count : 0;
    const profitFactor = grossLoss === 0 ? Infinity : grossProfit / grossLoss;
    const expectancy = count ? total / count : 0;

    const avgWinner = winners.length
      ? winners.reduce((a, b) => a + b, 0) / winners.length
      : 0;
    const avgLoser = losers.length
      ? losers.reduce((a, b) => a + b, 0) / losers.length
      : 0;

    // streaks (use chronological)
    const chronological = [...rows].sort((a, b) => {
      const ad = pickDate(a)?.getTime() ?? 0;
      const bd = pickDate(b)?.getTime() ?? 0;
      if (ad !== bd) return ad - bd;
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    });

    let curWin = 0,
      curLoss = 0,
      bestWin = 0,
      bestLoss = 0;
    for (const t of chronological) {
      const pnl = safeNum(t.pnl);
      if (pnl > 0) {
        curWin++;
        curLoss = 0;
      } else if (pnl < 0) {
        curLoss++;
        curWin = 0;
      } else {
        // break-even breaks both
        curWin = 0;
        curLoss = 0;
      }
      bestWin = Math.max(bestWin, curWin);
      bestLoss = Math.max(bestLoss, curLoss);
    }

    return {
      count,
      total,
      wins,
      losses,
      winRate,
      profitFactor,
      expectancy,
      avgWinner,
      avgLoser,
      best: best === -Infinity ? 0 : best,
      worst: worst === Infinity ? 0 : worst,
      bestWin,
      bestLoss,
    };
  }, [filteredTrades]);

  const equityData = useMemo(() => {
    const rows = [...(filteredTrades as any[])].sort((a, b) => {
      const ad = pickDate(a)?.getTime() ?? 0;
      const bd = pickDate(b)?.getTime() ?? 0;
      if (ad !== bd) return ad - bd;
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    });

    let cum = 0;
    return rows.map((t) => {
      const d = pickDate(t) ?? new Date();
      cum += safeNum(t.pnl);
      return {
        x: d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }),
        y: Number(cum.toFixed(2)),
      };
    });
  }, [filteredTrades]);

  const longShort = useMemo(() => {
    const rows = filteredTrades as any[];
    const obj = {
      Long: { count: 0, pnl: 0, wins: 0 },
      Short: { count: 0, pnl: 0, wins: 0 },
    };

    for (const t of rows) {
      const dir = getDirection(t);
      const pnl = safeNum(t.pnl);
      obj[dir].count++;
      obj[dir].pnl += pnl;
      if (pnl > 0) obj[dir].wins++;
    }

    const longWin = obj.Long.count ? obj.Long.wins / obj.Long.count : 0;
    const shortWin = obj.Short.count ? obj.Short.wins / obj.Short.count : 0;

    return {
      long: { ...obj.Long, winRate: longWin },
      short: { ...obj.Short, winRate: shortWin },
    };
  }, [filteredTrades]);

  const dayPerf = useMemo(() => {
    // Mon..Sun
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const sums = new Array(7).fill(0);

    for (const t of filteredTrades as any[]) {
      const d = pickDate(t);
      if (!d) continue;
      const idx = (d.getDay() + 6) % 7; // monday=0
      sums[idx] += safeNum(t.pnl);
    }

    const maxAbs = Math.max(1, ...sums.map((v) => Math.abs(v)));

    return labels.map((label, i) => {
      const value = sums[i];
      const widthPct = (Math.abs(value) / maxAbs) * 100;

      const tone: "profit" | "loss" | "zero" =
        value > 0 ? "profit" : value < 0 ? "loss" : "zero";

      return { label, value, widthPct, tone };
    });
  }, [filteredTrades]);

  const topSymbols = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>();
    for (const t of filteredTrades as any[]) {
      const sym = String(t.symbol ?? "").toUpperCase();
      if (!sym) continue;
      const pnl = safeNum(t.pnl);

      const cur = map.get(sym) ?? { pnl: 0, count: 0, wins: 0 };
      cur.pnl += pnl;
      cur.count += 1;
      if (pnl > 0) cur.wins += 1;
      map.set(sym, cur);
    }

    const arr = Array.from(map.entries()).map(([symbol, v]) => ({
      symbol,
      pnl: v.pnl,
      count: v.count,
      winRate: v.count ? v.wins / v.count : 0,
    }));

    arr.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    return arr.slice(0, 5);
  }, [filteredTrades]);

  const sessionPerf = useMemo(() => {
    const sessions: ("Asia" | "London" | "New York")[] = [
      "Asia",
      "London",
      "New York",
    ];
    const obj: Record<string, { pnl: number; count: number; wins: number }> = {
      Asia: { pnl: 0, count: 0, wins: 0 },
      London: { pnl: 0, count: 0, wins: 0 },
      "New York": { pnl: 0, count: 0, wins: 0 },
    };

    for (const t of filteredTrades as any[]) {
      const s = String(t.session ?? "");
      if (!obj[s]) continue;
      const pnl = safeNum(t.pnl);
      obj[s].pnl += pnl;
      obj[s].count += 1;
      if (pnl > 0) obj[s].wins += 1;
    }

    const maxAbs = Math.max(1, ...sessions.map((s) => Math.abs(obj[s].pnl)));

    return sessions.map((s) => ({
      name: s,
      pnl: obj[s].pnl,
      count: obj[s].count,
      winRate: obj[s].count ? obj[s].wins / obj[s].count : 0,
      barPct: (Math.abs(obj[s].pnl) / maxAbs) * 100,
    }));
  }, [filteredTrades]);

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* ===== Top header + filters like screenshot #1 ===== */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center min-w-0">
          {/* TIME PERIOD */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center min-w-0">
            <div className="shrink-0 text-[11px] font-semibold tracking-widest text-zinc-500">
              TIME PERIOD
            </div>
            <div className="w-full overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]">
              <div className="flex w-max items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                <Pill
                  active={period === "today"}
                  onClick={() => setPeriod("today")}
                >
                  Today
                </Pill>
                <Pill active={period === "7d"} onClick={() => setPeriod("7d")}>
                  7 Days
                </Pill>
                <Pill
                  active={period === "30d"}
                  onClick={() => setPeriod("30d")}
                >
                  30 Days
                </Pill>
                <Pill active={period === "3m"} onClick={() => setPeriod("3m")}>
                  3 Months
                </Pill>
                <Pill active={period === "1y"} onClick={() => setPeriod("1y")}>
                  1 Year
                </Pill>
                <Pill
                  active={period === "all"}
                  onClick={() => setPeriod("all")}
                >
                  All Time
                </Pill>
              </div>
            </div>
          </div>

          {/* FILTER BY */}
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center min-w-0">
            <div className="shrink-0 text-[11px] font-semibold tracking-widest text-zinc-500">
              FILTER BY
            </div>
            <div className="w-full overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]">
              <div className="flex w-max items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                <Pill
                  active={resultFilter === "all"}
                  onClick={() => setResultFilter("all")}
                >
                  All Trades
                </Pill>
                <Pill
                  active={resultFilter === "winners"}
                  onClick={() => setResultFilter("winners")}
                >
                  ✓ Winners
                </Pill>
                <Pill
                  active={resultFilter === "losers"}
                  onClick={() => setResultFilter("losers")}
                >
                  × Losers
                </Pill>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Top 4 metric cards ===== */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric
          title="TOTAL P&L"
          icon={
            <DollarSign
              size={30}
              strokeWidth={2.5}
              className="text-emerald-300"
            />
          }
          value={formatK(stats.total)}
          sub={`From ${stats.count} closed trades`}
          highlight
        />
        <Metric
          title="WIN RATE"
          icon={
            <Target size={30} strokeWidth={2.5} className="text-indigo-500" />
          }
          value={`${(stats.winRate * 100).toFixed(1)}%`}
          sub={`${stats.wins} wins • ${stats.losses} losses`}
          progress={stats.winRate}
        />
        <Metric
          title="PROFIT FACTOR"
          icon={<Scale size={30} strokeWidth={2.5} className="text-sky-400" />}
          value={
            Number.isFinite(stats.profitFactor)
              ? stats.profitFactor.toFixed(2)
              : "Infinity"
          }
          sub="Gross profit ÷ Gross loss (above 1.5 is good)"
        />
        <Metric
          title="EXPECTANCY"
          icon={<Sigma size={20} strokeWidth={2.6} className="text-sky-400" />}
          value={formatK(stats.expectancy)}
          sub="Average per trade"
        />
      </div>

      {/* ===== row: Quick stats + Equity curve ===== */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_1fr]">
        <Panel>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <ClipboardList
              size={20}
              strokeWidth={2.6}
              className="text-sky-400"
            />
            <span>Quick Stats</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="AVG WINNER" value={formatK(stats.avgWinner)} />
            <MiniStat
              label="AVG LOSER"
              value={`-${formatK(Math.abs(stats.avgLoser)).replace("+", "")}`}
              danger
            />
            <MiniStat label="BEST TRADE" value={formatK(stats.best)} />
            <MiniStat
              label="WORST TRADE"
              value={`-${formatK(Math.abs(stats.worst)).replace("+", "")}`}
              danger
            />
            <MiniStat label="WIN STREAK" value={`${stats.bestWin} trades`} />
            <MiniStat
              label="LOSS STREAK"
              value={`${stats.bestLoss} trades`}
              danger
            />
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <TrendingUp
                  size={20}
                  strokeWidth={2.6}
                  className="text-sky-400"
                />
                <span>Equity Curve</span>
              </div>
              <div className="text-sm text-zinc-500">
                Cumulative P&amp;L progression
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1 text-xs">
              <button
                className="rounded-xl bg-blue-600 px-3 py-1.5 font-semibold text-white"
                disabled
              >
                Equity
              </button>
              {/* <button className="rounded-xl px-3 py-1.5 font-semibold text-zinc-400 hover:bg-white/5">
                Drawdown
              </button> */}
            </div>
          </div>

          <div className="mt-4 h-[260px]">
            {loading ? (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                Loading…
              </div>
            ) : equityData.length < 2 ? (
              <div className="grid h-full place-items-center text-sm text-zinc-500">
                Close more trades to see your equity curve
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                      <stop offset="100%" stopColor="rgba(59,130,246,0.00)" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="x"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                  />

                  <YAxis
                    orientation="right"
                    tick={{ fill: "rgba(59,130,246,0.65)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => {
                      const abs = Math.abs(v);
                      const sign = v < 0 ? "-" : "";
                      if (abs >= 1000)
                        return `${sign}$${(abs / 1000).toFixed(1)}K`;
                      return `${sign}$${abs.toFixed(0)}`;
                    }}
                  />

                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const val = payload[0].value as number;
                      return (
                        <div className="rounded-2xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-sm text-white shadow-xl">
                          <div className="text-xs text-zinc-400">{label}</div>
                          <div className="mt-1 text-2xl font-semibold text-sky-300">
                            {val >= 0 ? "+" : "-"}${Math.abs(val).toFixed(2)}
                          </div>
                          <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
                            CUMULATIVE P&amp;L
                          </div>
                        </div>
                      );
                    }}
                  />

                  <Area
                    type="linear"
                    dataKey="y"
                    stroke="rgba(59,130,246,0.95)"
                    strokeWidth={2.5}
                    fill="url(#eqFill)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      strokeWidth: 2,
                      stroke: "rgba(59,130,246,1)",
                      fill: "rgba(0,0,0,1)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* =========================
          SECOND SCREEN CONTENT (Trade Analysis view)
         ========================= */}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Long vs Short */}
        <Panel>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <ArrowUpDown
              size={20}
              strokeWidth={2.6}
              className="text-sky-400 shrink-0"
            />
            <span>Long vs Short</span>
          </div>
          <div className="text-sm text-zinc-500">
            Performance by trade direction
          </div>

          <div className="mt-4 space-y-3">
            <DirCard
              title="Long"
              count={longShort.long.count}
              pnl={longShort.long.pnl}
              winRate={longShort.long.winRate}
            />

            <DirCard
              title="Short"
              count={longShort.short.count}
              pnl={longShort.short.pnl}
              winRate={longShort.short.winRate}
            />
          </div>
        </Panel>

        {/* Day Performance */}
        <Panel>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <CalendarDays
              size={20}
              strokeWidth={2.6}
              className="text-sky-400 shrink-0"
            />
            <span>Day Performance</span>
          </div>
          <div className="text-sm text-zinc-500">
            Find your best trading days
          </div>

          <div className="mt-4 space-y-3">
            {dayPerf.map((d) => {
              const barClass =
                d.tone === "profit"
                  ? "bg-green-600"
                  : d.tone === "loss"
                    ? "bg-rose-600"
                    : "bg-blue-500";

              const valueClass =
                d.tone === "profit"
                  ? "text-green-500"
                  : d.tone === "loss"
                    ? "text-red-500"
                    : "text-blue-500";

              return (
                <div key={d.label} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-9 sm:w-10 text-[12px] sm:text-sm text-zinc-400">
                    {d.label}
                  </div>

                  <div className="relative h-9 flex-1 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-xl ${barClass}`}
                      style={{
                        width: `${clamp(d.widthPct, 2, 100)}%`,
                        opacity: d.value === 0 ? 0.35 : 0.9,
                      }}
                    />
                  </div>

                  <div
                    className={`w-16 sm:w-20 text-right text-[12px] sm:text-sm font-semibold ${valueClass} tabular-nums`}
                  >
                    {d.value === 0 ? "+$0.00" : formatK(d.value)}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Top Symbols */}
        <Panel>
          <div className="flex items-center gap-2 text-lg font-semibold text-white">
            <Trophy
              size={20}
              strokeWidth={2.6}
              className="text-sky-400 shrink-0"
            />
            <span>Top Symbols</span>
          </div>
          <div className="text-sm text-zinc-500">Best performing assets</div>

          <div className="mt-4 space-y-3">
            {topSymbols.length === 0 ? (
              <div className="text-sm text-zinc-500">No data</div>
            ) : (
              topSymbols.map((s, idx) => (
                <div
                  key={s.symbol}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-sky-600/20 text-sky-300 text-sm font-semibold">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{s.symbol}</div>
                      <div className="text-xs text-zinc-500">
                        {s.count} trades • {(s.winRate * 100).toFixed(0)}% win
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-right font-extrabold ${
                      s.pnl >= 0 ? "text-blue-600" : "text-rose-600"
                    }`}
                  >
                    {s.pnl >= 0
                      ? `+$${Math.abs(s.pnl).toFixed(2)}`
                      : `-$${Math.abs(s.pnl).toFixed(2)}`}
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Session Performance (full width like screenshot) */}
      <Panel>
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <Globe
            size={20}
            strokeWidth={2.6}
            className="text-sky-400 shrink-0"
          />
          <span>Session Performance</span>
        </div>
        <div className="text-sm text-zinc-500">
          Breakdown by trading session — Asian, London &amp; New York
        </div>

        {/* timeline bar */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
          <div className="grid grid-cols-3 text-[11px] sm:text-sm">
            <div className="px-3 py-2 text-center h-10 bg-amber-500/15">
              ASIAN
            </div>
            <div className="px-3 py-2 text-center h-10 bg-sky-500/15">
              LONDON
            </div>
            <div className="px-3 py-2 text-center h-10 bg-emerald-500/15">
              NEW YORK
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 text-[11px] sm:text-xs text-zinc-500">
            <span>00:00</span>
            <span>08:00</span>
            <span>13:00</span>
            <span>22:00</span>
          </div>
        </div>

        {/* session cards */}
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {sessionPerf.map((s) => (
            <div
              key={s.name}
              className="rounded-3xl border border-white/10 bg-black/20 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {s.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {s.name === "Asia"
                      ? "22:00 — 08:00 UTC"
                      : s.name === "London"
                        ? "08:00 — 13:00 UTC"
                        : "13:00 — 22:00 UTC"}
                  </div>
                </div>

                <div className="text-sm font-semibold text-sky-400">
                  {formatK(s.pnl)}
                </div>
              </div>

              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-sky-500"
                  style={{ width: `${clamp(s.barPct, 2, 100)}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
                    TRADES
                  </div>
                  <div className="mt-1 font-semibold text-white">{s.count}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
                    WIN RATE
                  </div>
                  <div className="mt-1 font-semibold text-sky-400">
                    {s.count ? `${(s.winRate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* =========================
  Small UI components
========================= */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "rounded-3xl border border-white/10 bg-zinc-950/40 p-5",
        "shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[2px] hover:border-white/15 hover:bg-zinc-950/50",
        "hover:shadow-[0_28px_80px_rgba(0,0,0,0.55)]",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-xl px-1.5 py-2 text-[11px] sm:px-3 sm:text-xs font-semibold transition whitespace-nowrap",
        active ? "bg-blue-600 text-white" : "text-zinc-400 hover:bg-white/5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Metric({
  title,
  icon,
  value,
  sub,
  highlight,
  progress,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  sub: string;
  highlight?: boolean;
  progress?: number; // 0..1
}) {
  return (
    <div
      className={[
        "group relative rounded-3xl border p-5",
        "border-white/10 bg-zinc-950/40",
        highlight ? "ring-1 ring-sky-500/20" : "",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[2px] hover:border-white/15 hover:bg-zinc-950/50",
        "hover:shadow-[0_24px_70px_rgba(0,0,0,0.55)]",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-70 [background:radial-gradient(70%_60%_at_20%_0%,rgba(59,130,246,0.16),transparent_60%)]" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/10 text-sky-300 transition-transform duration-300 group-hover:scale-[1.06]">
            <span className="text-xl">{icon}</span>
          </div>
        </div>

        <div className="mt-4 text-[11px] font-semibold tracking-widest text-zinc-500">{title}</div>

        <div className="mt-2 text-4xl font-bold tracking-tight text-blue-500 transition-transform duration-300 group-hover:translate-y-[-1px]">
          {value}
        </div>

        <div className="mt-2 text-xs text-zinc-600">{sub}</div>

        {typeof progress === "number" ? (
          <div className="mt-4 h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-2 rounded-full bg-sky-500 transition-[width] duration-500 ease-out"
              style={{ width: `${clamp(progress * 100, 0, 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div
      className={[
        "group rounded-2xl border border-white/10 bg-black/20 p-4",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[1px] hover:bg-black/25 hover:border-white/15",
      ].join(" ")}
    >
      <div className="text-[11px] font-bold tracking-widest text-zinc-500">{label}</div>
      <div
        className={[
          "mt-2 text-xl font-bold tabular-nums",
          "transition-transform duration-300 group-hover:translate-y-[-1px]",
          danger ? "text-rose-500" : "text-sky-500",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function DirCard({
  title,
  count,
  pnl,
  winRate,
}: {
  title: "Long" | "Short";
  count: number;
  pnl: number;
  winRate: number;
}) {
  const isLong = title === "Long";

  const leftLine = isLong ? "bg-blue-500" : "bg-rose-500";
  const icon = isLong ? (
    <ArrowUpRight size={18} />
  ) : (
    <ArrowDownRight size={18} />
  );
  const accentText = isLong
    ? "font-semibold text-blue-500"
    : "font-semibold text-blue-500";
  const accentBorder = isLong ? "border-emerald-500/25" : "border-rose-500/25";

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 transition-all duration-300 ease-out hover:-translate-y-[2px] hover:border-white/15 hover:bg-black/25 hover:shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
      {/* LEFT COLOR LINE */}
      <div className={`absolute left-0 top-0 h-full w-1.5 ${leftLine}`} />

      <div className="p-5">
        <div className="flex items-center gap-2 text-lg font-semibold">
          {icon}
          <span>{title}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
              TRADES
            </div>
            <div className="mt-1 font-semibold text-white">{count}</div>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
              P&amp;L
            </div>
            <div className={`mt-1 font-semibold ${accentText}`}>
              {formatK(pnl)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
              WIN %
            </div>
            <div className={`mt-1 font-semibold ${accentText}`}>
              {(winRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* subtle inner border like screenshot */}
        <div
          className={`mt-4 rounded-2xl border ${accentBorder} bg-black/10 px-3 py-2 text-xs text-zinc-500`}
        >
          Performance summary
        </div>
      </div>
    </div>
  );
}
