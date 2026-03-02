import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import type { Trade } from "../types";
import { money } from "../lib/format";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Clock,
  DollarSign,
  Target,
  CheckCircle2,
  BarChart3,
} from "lucide-react";

/* ========================
   Dashboard
========================= */

export default function Dashboard() {
  const { user } = useAuthState();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) return;
      setLoading(true);

      // ✅ no composite index needed (no orderBy). We sort in JS.
      const q = query(collection(db, "trades"), where("uid", "==", user.uid));
      const snap = await getDocs(q);

      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as any[];

      rows.sort((a, b) => {
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

  const totalPL = useMemo(() => {
    return trades.reduce((sum: number, t: any) => sum + Number(t.pnl ?? 0), 0);
  }, [trades]);

  const winRate = useMemo(() => {
    const closed = trades.length;
    if (!closed) return 0;
    const wins = trades.filter((t: any) => Number(t.pnl ?? 0) > 0).length;
    return wins / closed;
  }, [trades]);

  const realized = totalPL;
  const unrealized = 0;

  return (
    <div className="space-y-6">
      {/* ===== Top metric cards (4) ===== */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="TOTAL P&L"
          badge="TOTAL"
          iconBg="bg-sky-500/15"
          tone="blue"
          icon={
            <DollarSign
              size={30}
              strokeWidth={2.5}
              className={totalPL >= 0 ? "text-emerald-300" : "text-rose-300"}
            />
          }
          value={`${totalPL >= 0 ? "+" : "-"}${money(Math.abs(totalPL))}`}
          sub={<span className="text-sky-400">→ {trades.length} trades</span>}
          accent="sky"
          highlight
        />

        <MetricCard
          title="UNREALIZED"
          iconBg="bg-amber-500/15"
          tone="amber"
          icon={
            <Clock size={30} strokeWidth={2.5} className="text-amber-300" />
          }
          value={`${unrealized >= 0 ? "+" : "-"}${money(Math.abs(unrealized))}`}
          sub={<span className="text-zinc-500">0 open positions</span>}
        />

        <MetricCard
          title="REALIZED"
          iconBg="bg-sky-500/15"
          tone="green"
          icon={
            <CheckCircle2
              size={30}
              strokeWidth={2.5}
              className={realized >= 0 ? "text-emerald-300" : "text-rose-300"}
            />
          }
          value={`${realized >= 0 ? "+" : "-"}${money(Math.abs(realized))}`}
          sub={
            <span className="text-zinc-500">{trades.length} closed trades</span>
          }
          accent="sky"
        />

        <MetricCard
          title="WIN RATE"
          iconBg="bg-indigo-500/15"
          tone="rose"
          icon={
            <Target size={30} strokeWidth={2.5} className="text-indigo-500" />
          }
          value={`${Math.round(winRate * 100)}%`}
          sub={
            <div className="mt-3 h-2 w-full rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-sky-500"
                style={{
                  width: `${Math.max(0, Math.min(100, winRate * 100))}%`,
                }}
              />
            </div>
          }
        />
      </div>

      {/* ===== Middle row ===== */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1fr_520px]">
        {/* Performance */}
        <Panel>
          <PerformanceChart trades={trades} totalPL={totalPL} />
        </Panel>

        {/* Monthly P&L */}
        <Panel>
          <MonthlyCalendar trades={trades} />
        </Panel>
      </div>

      {/* ===== Recent trades ===== */}
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold text-white">
              <Clock
                size={20}
                strokeWidth={2.6}
                className="text-sky-400 shrink-0"
              />
              <span>Recent Trades</span>
            </div>
            <div className="text-sm text-zinc-500">Latest activity</div>
          </div>

          <Link
            className="text-sm font-semibold text-zinc-200 hover:underline"
            to="/trades"
          >
            View all
          </Link>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm text-zinc-400">Loading…</div>
          ) : trades.length === 0 ? (
            <div className="text-sm text-zinc-400">
              No trades yet. Add your first trade.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-zinc-500">
                  <tr className="border-b border-white/10">
                    <th className="px-2 py-3 text-left font-semibold">
                      Symbol
                    </th>
                    <th className="px-2 py-3 text-left font-semibold">Date</th>
                    <th className="px-2 py-3 text-left font-semibold">Side</th>
                    <th className="px-2 py-3 text-right font-semibold">
                      P&amp;L
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {trades.slice(0, 8).map((t: any) => (
                    <tr key={t.id} className="hover:bg-white/5">
                      <td className="px-2 py-3 font-semibold text-white">
                        {t.symbol}
                      </td>
                      <td className="px-2 py-3 text-zinc-500">{t.entryDate}</td>
                      <td className="px-2 py-3">
                        <span
                          className={[
                            "rounded-lg border px-2 py-1 text-xs font-semibold",
                            t.side === "BUY"
                              ? "border-emerald-900/60 bg-emerald-900/20 text-emerald-200"
                              : "border-rose-900/60 bg-rose-900/20 text-rose-200",
                          ].join(" ")}
                        >
                          {t.side}
                        </span>
                      </td>
                      <td
                        className={[
                          "px-2 py-3 text-right font-semibold",
                          Number(t.pnl) >= 0
                            ? "text-green-500"
                            : "text-red-500",
                        ].join(" ")}
                      >
                        {Number(t.pnl) >= 0 ? "+" : "-"}
                        {money(Math.abs(Number(t.pnl) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Link
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
            to="/new"
          >
            + Add trade
          </Link>
        </div>
      </Panel>
    </div>
  );
}

/* =========================
   UI building blocks
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

function MetricCard({
  title,
  badge,
  icon,
  iconBg,
  value,
  sub,
  accent,
  highlight,
  tone,
}: {
  title: string;
  badge?: string;
  icon: React.ReactNode;
  iconBg: string;
  value: string;
  sub?: React.ReactNode;
  accent?: "sky";
  highlight?: boolean;
  tone?: "blue" | "green" | "amber" | "rose";
}) {
  const toneStyles = {
    blue: {
      glow: "shadow-[0_20px_70px_rgba(59,130,246,0.18)]",
      surface: "bg-gradient-to-b from-blue-800/[0.07] to-zinc-950/40",
    },
    green: {
      glow: "shadow-[0_20px_70px_rgba(16,185,129,0.18)]",
      surface: "bg-gradient-to-b from-emerald-800/[0.07] to-zinc-950/40",
    },
    amber: {
      glow: "shadow-[0_20px_70px_rgba(245,158,11,0.18)]",
      surface: "bg-gradient-to-b from-amber-800/[0.07] to-zinc-950/40",
    },
    rose: {
      glow: "shadow-[0_20px_70px_rgba(244,63,94,0.18)]",
      surface: "bg-gradient-to-b from-rose-800/[0.07] to-zinc-950/40",
    },
  };

  const currentTone = tone ? toneStyles[tone] : null;
  return (
    <div
      className={[
        "rounded-3xl border p-5 border-white/10 transition-all duration-300",
        currentTone?.surface ?? "bg-zinc-950/40",
        currentTone?.glow ?? "shadow-[0_20px_60px_rgba(0,0,0,0.4)]",
        "hover:-translate-y-1 hover:border-white/15",
        highlight ? "ring-1 ring-sky-500/15" : "",
      ].join(" ")}
    >
      {/* subtle hover glow */}
      <div
        className={[
          "pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300",
          highlight ? "group-hover:opacity-100" : "group-hover:opacity-70",
          "[background:radial-gradient(70%_60%_at_20%_0%,rgba(59,130,246,0.18),transparent_60%)]",
        ].join(" ")}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div
            className={[
              "grid h-12 w-12 place-items-center rounded-2xl",
              "transition-transform duration-300 ease-out",
              "group-hover:scale-[1.06]",
              iconBg,
            ].join(" ")}
          >
            <span className="text-xl">{icon}</span>
          </div>

          {badge ? (
            <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-bold tracking-wide text-sky-200">
              {badge}
            </span>
          ) : null}
        </div>

        <div className="mt-4 text-[11px] font-semibold tracking-widest text-zinc-500">
          {title}
        </div>

        <div
          className={[
            "mt-2 text-3xl sm:text-4xl font-bold tracking-tight",
            "transition-transform duration-300 ease-out",
            "group-hover:translate-y-[-1px]",
            accent === "sky" ? "text-blue-500" : "text-white",
          ].join(" ")}
        >
          {value}
        </div>

        {sub ? <div className="mt-2 text-[9px] sm:text-xs text-zinc-600">{sub}</div> : null}
      </div>
    </div>
  );
}

/* =========================
   PERFORMANCE CHART
========================= */

function PerformanceChart({
  trades,
  totalPL,
}: {
  trades: Trade[];
  totalPL: number;
}) {
  const [range, setRange] = useState<"1D" | "1W" | "1M" | "3M" | "ALL">("1W");

  const parseYMD = (v?: any) => {
    if (!v) return null;

    // Firestore Timestamp
    if (typeof v?.toDate === "function") return v.toDate();

    // JS Date
    if (v instanceof Date) return v;

    // String parsing
    if (typeof v === "string") {
      const s = v.trim();

      // YYYY-MM-DD or YYYY-M-D
      const dash = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dash) {
        const y = Number(dash[1]);
        const m = Number(dash[2]);
        const d = Number(dash[3]);
        return new Date(y, m - 1, d);
      }

      // YYYY/MM/DD or YYYY/M/D
      const slashYMD = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
      if (slashYMD) {
        const y = Number(slashYMD[1]);
        const m = Number(slashYMD[2]);
        const d = Number(slashYMD[3]);
        return new Date(y, m - 1, d);
      }

      // MM/DD/YYYY
      const slashMDY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (slashMDY) {
        const m = Number(slashMDY[1]);
        const d = Number(slashMDY[2]);
        const y = Number(slashMDY[3]);
        return new Date(y, m - 1, d);
      }

      // last resort (ISO etc.)
      const dt = new Date(s);
      if (!isNaN(dt.getTime())) return dt;
    }

    return null;
  };

  const inRange = (d: Date) => {
    if (range === "ALL") return true;
    const now = new Date();
    const start = new Date(now);
    if (range === "1D") start.setDate(now.getDate() - 1);
    if (range === "1W") start.setDate(now.getDate() - 7);
    if (range === "1M") start.setMonth(now.getMonth() - 1);
    if (range === "3M") start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    return d >= start && d <= now;
  };

  const data = useMemo(() => {
    const rows = [...trades]
      .map((t: any) => {
        const d = parseYMD(t.entryDate) ?? new Date(0);
        const ts = t.createdAt?.toMillis?.() ?? 0;
        return { ...t, __d: d, __ts: ts };
      })
      .sort(
        (a: any, b: any) =>
          a.__d.getTime() - b.__d.getTime() || a.__ts - b.__ts,
      )
      .filter((t: any) => t.__d && inRange(t.__d));

    let cum = 0;
    return rows.map((t: any) => {
      cum += Number(t.pnl ?? 0);
      const d = t.__d as Date;
      const label = d.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
      });
      return { x: label, y: Number(cum.toFixed(2)) };
    });
  }, [trades, range]);

  const { domainMin, domainMax, ticks } = useMemo(() => {
    const ys = data.map((p) => p.y);
    const min = ys.length ? Math.min(...ys) : 0;
    const max = ys.length ? Math.max(...ys) : 0;

    const span = Math.max(1, max - min);
    const pad = span * 0.12;

    const dMin = Math.floor((min - pad) / 10) * 10;
    const dMax = Math.ceil((max + pad) / 10) * 10;

    const count = 6;
    const step = (dMax - dMin) / (count - 1 || 1);
    const tks = Array.from({ length: count }, (_, i) =>
      Number((dMin + step * i).toFixed(0)),
    );
    return { domainMin: dMin, domainMax: dMax, ticks: tks };
  }, [data]);

  const formatTick = (v: number) => {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-zinc-500">
            <TrendingUp size={20} strokeWidth={2.6} className="text-sky-400" />
            <span>PERFORMANCE</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="text-3xl font-bold tracking-tight text-sky-400">
              {totalPL >= 0 ? "+" : "-"}${Math.abs(totalPL).toFixed(2)}
            </div>

            <div className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-sm font-semibold text-sky-300">
              ↗ {data.length ? "999.9%" : "0.0%"}
            </div>
          </div>
        </div>

        {/* ✅ Mobile: buttons go below profit/percentage; Desktop: stays on right */}
        <div className="max-w-full overflow-x-auto sm:overflow-visible">
          <div className="flex w-max items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1 text-xs sm:w-auto">
            {(["1D", "1W", "1M", "3M", "ALL"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRange(t)}
                className={[
                  "rounded-xl px-3 py-2 sm:px-4 font-semibold",
                  range === t
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:bg-white/5",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(59,130,246,0.35)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0.00)" />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />

            <XAxis
              dataKey="x"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={18}
            />

            <YAxis
              ticks={ticks}
              domain={[domainMin, domainMax]}
              tickFormatter={formatTick}
              tick={{ fill: "rgba(59,130,246,0.65)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              orientation="right"
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
              type="linear" // curvy chart - type="monotone"
              dataKey="y"
              stroke="rgba(59,130,246,0.95)"
              strokeWidth={2.5}
              fill="url(#pnlFill)"
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
      </div>
    </div>
  );
}

/* =========================
   Monthly Calendar with Weekly totals
========================= */

function MonthlyCalendar({
  trades,
  monthDate = new Date(),
}: {
  trades: Trade[];
  monthDate?: Date;
}) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  // ---- helpers ----
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const keyOf = (d: Date) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const parseYMD = (s?: string) => {
    if (!s) return null;
    // expects YYYY-MM-DD
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };

  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  // const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  // Monday-start index (Mon=0 ... Sun=6)
  const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

  // ---- daily pnl map ----
  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) {
      const dt = parseYMD((t as any).entryDate);
      if (!dt) continue;
      if (
        dt.getMonth() !== monthStart.getMonth() ||
        dt.getFullYear() !== monthStart.getFullYear()
      )
        continue;

      const k = keyOf(dt);
      map.set(k, (map.get(k) ?? 0) + Number((t as any).pnl ?? 0));
    }
    return map;
  }, [trades, monthStart.getFullYear(), monthStart.getMonth()]);

  // ---- build a fixed 6-week grid (6 rows x 7 days) ----
  const grid = useMemo(() => {
    const first = new Date(monthStart);
    const shift = mondayIndex(first); // leading blanks
    first.setDate(first.getDate() - shift);

    const weeks: (Date | null)[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: (Date | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(first);
        d.setDate(first.getDate() + w * 7 + i);

        // keep actual date object, but mark outside month as null
        if (
          d.getFullYear() === monthStart.getFullYear() &&
          d.getMonth() === monthStart.getMonth()
        ) {
          row.push(d);
        } else {
          row.push(null);
        }
      }
      weeks.push(row);
    }
    return weeks;
  }, [monthStart]);

  const monthLabel = useMemo(() => {
    return monthStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [monthStart]);

  const monthTotal = useMemo(() => {
    let sum = 0;
    for (const v of daily.values()) sum += v;
    return sum;
  }, [daily]);

  const money0 = (n: number) => {
    const abs = Math.abs(n);
    const s = abs.toFixed(2);
    return `${n >= 0 ? "+" : "-"}$${s}`;
  };

  // ---- styles (exact squares) ----
  const cellBase =
    "aspect-square rounded-md border border-white/10 bg-black/20 hover:bg-white/5 transition";
  const cellInner = "relative h-full w-full p-0.5 sm:p-3";

  return (
    <div className="mt-4">
      {/* header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10">
            <BarChart3 size={18} strokeWidth={2.6} className="text-sky-400" />
          </div>

          <div className="text-lg font-semibold text-white">Monthly P&L</div>
        </div>
        <div className="text-sm text-zinc-500">
          Monthly:{" "}
          <span className="font-semibold text-sky-400">
            {money0(monthTotal)}
          </span>
          <span className="ml-2 font-medium">{monthLabel}</span>
        </div>
      </div>

      {/* week day labels + Weekly label */}
      <div className="mt-4 grid grid-cols-8 gap-px text-[9px] sm:text-xs font-bold text-zinc-500">
        {days.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
        <div className="text-center">Weekly</div>
      </div>

      {/* grid: 7 days + 1 weekly square (same size) */}
      <div className="mt-3 overflow-hidden">
        <div className="grid w-full max-w-full grid-cols-8 gap-px">
          {grid.map((week, wi) => {
            // weekly sum for this row (only dates inside current month)
            let wSum = 0;
            for (const d of week) {
              if (!d) continue;
              wSum += daily.get(keyOf(d)) ?? 0;
            }

            return (
              <React.Fragment key={wi}>
                {week.map((d, di) => {
                  const k = d ? keyOf(d) : "";
                  const pnl = d ? (daily.get(k) ?? 0) : 0;
                  const has = d && daily.has(k);

                  const ring =
                    has && pnl > 0
                      ? "ring-1 ring-sky-500/40"
                      : has && pnl < 0
                        ? "ring-1 ring-rose-500/35"
                        : "";

                  return (
                    <div
                      key={`${wi}-${di}`}
                      className={`${cellBase} ${ring} ${!d ? "opacity-40" : ""} min-w-0`}
                    >
                      <div className={cellInner}>
                        <div className="absolute left-0.5 top-0.5 sm:left-0.5 sm:top-0.5 text-[6px] sm:text-[10px] font-semibold tracking-widest text-zinc-500">
                          {d ? d.getDate() : ""}
                        </div>

                        {d && has ? (
                          <div
                            className={[
                              "absolute inset-0 flex items-center justify-center font-semibold tabular-nums",
                              "text-[7.5px] sm:text-xs leading-none",
                              "px-0.5 sm:px-1 whitespace-nowrap",
                              pnl >= 0 ? "text-green-400" : "text-rose-400",
                            ].join(" ")}
                            title={`${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
                          >
                            {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                          </div>
                        ) : (
                          <div className="absolute inset-0" />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* weekly square (same size as day squares) */}
                <div
                  className={`${cellBase} ${wSum !== 0 ? "ring-1 ring-sky-500/30" : ""} min-w-0`}
                >
                  <div className="h-full w-full p-1 sm:p-2 flex flex-col justify-between">
                    <div className="text-[6px] sm:text-[9px] font-semibold tracking-widest text-zinc-500">
                      WEEKLY
                    </div>

                    <div
                      className="flex items-center justify-center font-semibold text-sky-400 tabular-nums min-w-0 max-w-full whitespace-nowrap text-[8px] sm:text-xs leading-none"
                      title={money0(wSum)}
                    >
                      {money0(wSum)}
                    </div>

                    {/* <div className="text-xs text-zinc-500 truncate">Traded...</div> */}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-500" />
          Profit
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Loss
        </div>
      </div>
    </div>
  );
}
