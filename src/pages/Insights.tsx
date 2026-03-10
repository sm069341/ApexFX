import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import type { Trade } from "../types";
import AnalysisSkeleton from "../components/AnalysisSkeleton";
import {
  Sparkles,
  Brain,
  AlertTriangle,
  BadgeCheck,
  Globe,
  CandlestickChart,
  Target,
  DollarSign,
  Coins,
  Clock,
} from "lucide-react";

/* =========================
  Helpers
========================= */

type PeriodKey = "today" | "7d" | "30d" | "3m" | "1y" | "all";
type ResultFilter = "all" | "winners" | "losers";

function parseYMD(s?: string) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pickDate(t: any): Date | null {
  const d1 = parseYMD(t?.entryDate);
  if (d1) return d1;

  const raw = t?.date;
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function formatK(n: number) {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
  return `${sign}$${abs.toFixed(2)}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
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
  return new Date(0);
}

function getTagLabel(t: any) {
  return Array.isArray(t?.tags) && t.tags.length ? String(t.tags[0]) : "";
}

function getStrategyAndTimeframe(tag: string) {
  if (!tag) return { strategy: "", timeframe: "" };

  const parts = tag.trim().split(" ").filter(Boolean);
  if (!parts.length) return { strategy: "", timeframe: "" };

  const timeframe = parts.pop() || "";
  const strategy = parts.join(" ");
  return { strategy, timeframe };
}

/* =========================
  Page
========================= */

export default function Insights() {
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

      try {
        const q = query(collection(db, "trades"), where("uid", "==", user.uid));
        const snap = await getDocs(q);

        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as any[];

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
      } catch (error) {
        console.error("Failed to load insights trades:", error);
        if (alive) setLoading(false);
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

  const summary = useMemo(() => {
    const rows = filteredTrades as any[];

    let totalPnl = 0;
    let wins = 0;
    let losses = 0;

    for (const t of rows) {
      const pnl = safeNum(t.pnl);
      totalPnl += pnl;
      if (pnl > 0) wins++;
      if (pnl < 0) losses++;
    }

    return {
      count: rows.length,
      totalPnl,
      wins,
      losses,
      winRate: rows.length ? (wins / rows.length) * 100 : 0,
    };
  }, [filteredTrades]);

  const strategyPerf = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        wins: number;
        pnl: number;
        timeframes: Record<string, number>;
      }
    >();

    for (const t of filteredTrades as any[]) {
      const tag = getTagLabel(t);
      if (!tag) continue;

      const { timeframe } = getStrategyAndTimeframe(tag);
      const key = tag;
      const pnl = safeNum(t.pnl);

      const cur = map.get(key) ?? {
        count: 0,
        wins: 0,
        pnl: 0,
        timeframes: {},
      };

      cur.count += 1;
      cur.pnl += pnl;
      if (pnl > 0) cur.wins += 1;
      if (timeframe)
        cur.timeframes[timeframe] = (cur.timeframes[timeframe] || 0) + 1;

      map.set(key, cur);
    }

    return Array.from(map.entries())
      .map(([tag, v]) => {
        const { strategy, timeframe } = getStrategyAndTimeframe(tag);
        return {
          tag,
          strategy,
          timeframe,
          count: v.count,
          pnl: v.pnl,
          winRate: v.count ? (v.wins / v.count) * 100 : 0,
        };
      })
      .sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl);
  }, [filteredTrades]);

  const symbolPerf = useMemo(() => {
    const map = new Map<string, { count: number; wins: number; pnl: number }>();

    for (const t of filteredTrades as any[]) {
      const symbol = String(t.symbol ?? "")
        .toUpperCase()
        .trim();
      if (!symbol) continue;

      const pnl = safeNum(t.pnl);
      const cur = map.get(symbol) ?? { count: 0, wins: 0, pnl: 0 };
      cur.count += 1;
      cur.pnl += pnl;
      if (pnl > 0) cur.wins += 1;
      map.set(symbol, cur);
    }

    return Array.from(map.entries())
      .map(([symbol, v]) => ({
        symbol,
        count: v.count,
        pnl: v.pnl,
        winRate: v.count ? (v.wins / v.count) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count || b.pnl - a.pnl);
  }, [filteredTrades]);

  const sessionPerf = useMemo(() => {
    const sessions: ("Asia" | "London" | "New York")[] = [
      "Asia",
      "London",
      "New York",
    ];

    const obj: Record<string, { count: number; wins: number; pnl: number }> = {
      Asia: { count: 0, wins: 0, pnl: 0 },
      London: { count: 0, wins: 0, pnl: 0 },
      "New York": { count: 0, wins: 0, pnl: 0 },
    };

    for (const t of filteredTrades as any[]) {
      const s = String(t.session ?? "");
      if (!obj[s]) continue;

      const pnl = safeNum(t.pnl);
      obj[s].count += 1;
      obj[s].pnl += pnl;
      if (pnl > 0) obj[s].wins += 1;
    }

    return sessions
      .map((name) => ({
        name,
        count: obj[name].count,
        pnl: obj[name].pnl,
        winRate: obj[name].count ? (obj[name].wins / obj[name].count) * 100 : 0,
      }))
      .sort((a, b) => b.pnl - a.pnl);
  }, [filteredTrades]);

  const bestTimeframeByStrategy = useMemo(() => {
    const rows = filteredTrades as any[];

    const strategyMap = new Map<
      string,
      Map<string, { count: number; wins: number; pnl: number }>
    >();

    for (const t of rows) {
      const tag =
        Array.isArray(t.tags) && t.tags.length ? String(t.tags[0]) : "";

      if (!tag) continue;

      const parts = tag.trim().split(" ").filter(Boolean);
      if (parts.length < 2) continue;

      const timeframe = parts.pop() || "";
      const strategy = parts.join(" ");

      const pnl = safeNum(t.pnl);

      if (!strategyMap.has(strategy)) {
        strategyMap.set(strategy, new Map());
      }

      const tfMap = strategyMap.get(strategy)!;

      const cur = tfMap.get(timeframe) ?? {
        count: 0,
        wins: 0,
        pnl: 0,
      };

      cur.count += 1;
      cur.pnl += pnl;

      if (pnl > 0) cur.wins += 1;

      tfMap.set(timeframe, cur);
    }

    const result: any[] = [];

    for (const [strategy, tfMap] of strategyMap.entries()) {
      const best = Array.from(tfMap.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([timeframe, v]) => ({
          strategy,
          timeframe,
          count: v.count,
          pnl: v.pnl,
          winRate: v.count ? (v.wins / v.count) * 100 : 0,
        }))
        .sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl)[0];

      if (best) result.push(best);
    }

    return result;
  }, [filteredTrades]);

  const bestSessionByStrategy = useMemo(() => {
    const rows = filteredTrades as any[];

    const strategyMap = new Map<
      string,
      Map<string, { count: number; wins: number; pnl: number }>
    >();

    for (const t of rows) {
      const tag =
        Array.isArray(t.tags) && t.tags.length ? String(t.tags[0]) : "";

      if (!tag) continue;

      const parts = tag.trim().split(" ").filter(Boolean);
      if (parts.length < 2) continue;

      parts.pop(); // remove timeframe
      const strategy = parts.join(" ");
      const session = String(t.session ?? "").trim();

      if (!strategy || !session) continue;

      const pnl = safeNum(t.pnl);

      if (!strategyMap.has(strategy)) {
        strategyMap.set(strategy, new Map());
      }

      const sessionMap = strategyMap.get(strategy)!;

      const cur = sessionMap.get(session) ?? {
        count: 0,
        wins: 0,
        pnl: 0,
      };

      cur.count += 1;
      cur.pnl += pnl;
      if (pnl > 0) cur.wins += 1;

      sessionMap.set(session, cur);
    }

    const result: any[] = [];

    for (const [strategy, sessionMap] of strategyMap.entries()) {
      const best = Array.from(sessionMap.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([session, v]) => ({
          strategy,
          session,
          count: v.count,
          pnl: v.pnl,
          winRate: v.count ? (v.wins / v.count) * 100 : 0,
        }))
        .sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl)[0];

      if (best) result.push(best);
    }

    return result;
  }, [filteredTrades]);

  const overtradingInsight = useMemo(() => {
    const dayMap = new Map<
      string,
      { count: number; pnl: number; wins: number }
    >();

    for (const t of filteredTrades as any[]) {
      const d = pickDate(t);
      if (!d) continue;

      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const pnl = safeNum(t.pnl);

      const cur = dayMap.get(key) ?? { count: 0, pnl: 0, wins: 0 };
      cur.count += 1;
      cur.pnl += pnl;
      if (pnl > 0) cur.wins += 1;

      dayMap.set(key, cur);
    }

    const highFreq = Array.from(dayMap.values()).filter((d) => d.count > 3);
    const lowFreq = Array.from(dayMap.values()).filter((d) => d.count <= 3);

    if (!highFreq.length || !lowFreq.length) return null;

    const highAvg =
      highFreq.reduce((sum, d) => sum + d.pnl, 0) / highFreq.length;
    const lowAvg = lowFreq.reduce((sum, d) => sum + d.pnl, 0) / lowFreq.length;

    return {
      highAvg,
      lowAvg,
      isWorse: highAvg < lowAvg,
    };
  }, [filteredTrades]);

  const streakInsight = useMemo(() => {
    const chronological = [...(filteredTrades as any[])].sort((a, b) => {
      const ad = pickDate(a)?.getTime() ?? 0;
      const bd = pickDate(b)?.getTime() ?? 0;
      if (ad !== bd) return ad - bd;
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    });

    let streakEvents = 0;
    let nextTradeLosses = 0;

    for (let i = 2; i < chronological.length; i++) {
      const a = safeNum(chronological[i - 2].pnl);
      const b = safeNum(chronological[i - 1].pnl);
      const c = safeNum(chronological[i].pnl);

      if (a < 0 && b < 0) {
        streakEvents++;
        if (c < 0) nextTradeLosses++;
      }
    }

    if (streakEvents < 2) return null;

    return {
      streakEvents,
      rate: (nextTradeLosses / streakEvents) * 100,
    };
  }, [filteredTrades]);

  const insights = useMemo(() => {
    const list: {
      title: string;
      text: string;
      tone: "blue" | "green" | "amber" | "rose";
      icon: React.ReactNode;
    }[] = [];

    const bestStrategy = strategyPerf
      .filter((s) => s.count >= 3)
      .sort((a, b) => b.winRate - a.winRate || b.pnl - a.pnl)[0];

    if (bestStrategy) {
      list.push({
        title: "Best Strategy",
        text: `${bestStrategy.tag} performs best with ${bestStrategy.winRate.toFixed(
          0,
        )}% win rate over ${bestStrategy.count} trades.`,
        tone: "green",
        icon: <BadgeCheck size={18} />,
      });
    }

    const worstSymbol = symbolPerf
      .filter((s) => s.count >= 3)
      .sort((a, b) => a.pnl - b.pnl)[0];

    if (worstSymbol) {
      list.push({
        title: "Worst Symbol",
        text: `You lose most on ${worstSymbol.symbol} with net P&L of ${formatK(
          worstSymbol.pnl,
        )}.`,
        tone: "rose",
        icon: <AlertTriangle size={18} />,
      });
    }

    const bestSession = sessionPerf.filter((s) => s.count >= 3)[0];

    const bestTfInsight = bestTimeframeByStrategy.sort(
      (a, b) => b.winRate - a.winRate || b.pnl - a.pnl,
    )[0];

    if (bestTfInsight) {
      list.push({
        title: "Best Timeframe",
        text: `Your best timeframe for ${bestTfInsight.strategy} is ${bestTfInsight.timeframe} with ${bestTfInsight.winRate.toFixed(0)}% win rate.`,
        tone: "blue",
        icon: <Sparkles size={18} />,
      });
    }
    const bestSessionInsight = bestSessionByStrategy.sort(
      (a, b) => b.winRate - a.winRate || b.pnl - a.pnl,
    )[0];

    if (bestSessionInsight) {
      list.push({
        title: "Best Session Setup",
        text: `You perform best with ${bestSessionInsight.strategy} during ${bestSessionInsight.session} session with ${bestSessionInsight.winRate.toFixed(0)}% win rate.`,
        tone: "green",
        icon: <Sparkles size={18} />,
      });
    }

    if (bestSession) {
      list.push({
        title: "Best Session",
        text: `${bestSession.name} session gives your best performance with ${formatK(
          bestSession.pnl,
        )} net P&L.`,
        tone: "blue",
        icon: <Globe size={18} />,
      });
    }

    if (overtradingInsight?.isWorse) {
      list.push({
        title: "Overtrading Warning",
        text: "Your results drop on days when you take more than 3 trades.",
        tone: "amber",
        icon: <Brain size={18} />,
      });
    }

    if (streakInsight) {
      list.push({
        title: "Loss Streak Insight",
        text: `After 2 consecutive losses, your next trade loses ${streakInsight.rate.toFixed(
          0,
        )}% of the time.`,
        tone: "rose",
        icon: <Sparkles size={18} />,
      });
    }

    if (!list.length && filteredTrades.length) {
      list.push({
        title: "Need More Data",
        text: "Add more trades to unlock stronger insight patterns.",
        tone: "blue",
        icon: <Sparkles size={18} />,
      });
    }

    return list.slice(0, 5);
  }, [
    strategyPerf,
    symbolPerf,
    sessionPerf,
    overtradingInsight,
    streakInsight,
    filteredTrades.length,
    bestTimeframeByStrategy,
    bestSessionByStrategy,
  ]);

  const bestStrategyCard = strategyPerf.filter((s) => s.count >= 3)[0];
  const worstStrategyCard = [...strategyPerf]
    .filter((s) => s.count >= 3 && s.tag !== bestStrategyCard?.tag)
    .sort((a, b) => a.winRate - b.winRate || a.pnl - b.pnl)[0];

  const topThreeStrategies = strategyPerf.slice(0, 6);
  const topThreeSymbols = [...symbolPerf]
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 6);

  if (loading) return <AnalysisSkeleton />;

  return (
    <div className="space-y-7 overflow-x-hidden">
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Metric
          title="TOTAL TRADES"
          value={<span className="text-blue-500">{String(summary.count)}</span>}
          sub="Trades in selected period"
          icon={
            <CandlestickChart
              size={28}
              strokeWidth={2.4}
              className="text-sky-300"
            />
          }
          iconBg="bg-sky-500/15"
          tone="blue"
        />

        <Metric
          title="WIN RATE"
          value={`${summary.winRate.toFixed(0)}%`}
          sub={`${summary.wins} wins • ${summary.losses} losses`}
          icon={
            <Target size={28} strokeWidth={2.4} className="text-emerald-300" />
          }
          iconBg="bg-emerald-500/15"
          tone="green"
        />

        <Metric
          title="NET P&L"
          value={
            <span className="text-blue-500">{formatK(summary.totalPnl)}</span>
          }
          sub="Total result for filtered trades"
          icon={
            <DollarSign
              size={30}
              strokeWidth={2.5}
              className="text-amber-300"
            />
          }
          iconBg="bg-amber-500/15"
          tone={summary.totalPnl >= 0 ? "green" : "rose"}
        />

        <Metric
          title="BEST SETUP"
          value={bestStrategyCard?.tag || "—"}
          sub={
            bestStrategyCard
              ? `${bestStrategyCard.winRate.toFixed(0)}% win • ${bestStrategyCard.count} trades`
              : "Add more setup data"
          }
          icon={
            <BadgeCheck
              size={30}
              strokeWidth={2.5}
              className="text-indigo-300"
            />
          }
          iconBg="bg-indigo-500/15"
          tone="blue"
        />
      </div>

      {/* AI insight cards */}
      <Panel>
        <div className="flex items-center gap-3 text-lg font-semibold text-white">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600/15 text-sky-300 shadow-[0_0_25px_rgba(59,130,246,0.18)]">
            <Brain
              size={30}
              strokeWidth={2.5}
              className="text-sky-400 shrink-0"
            />
          </div>
          <div>
            <div className="text-lg font-semibold text-white">AI Insights</div>
            <div className="text-sm text-zinc-500">
              Pattern-based feedback from your journal
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {insights.length === 0 ? (
            <div className="text-sm text-zinc-500">
              Add more trades to unlock insights.
            </div>
          ) : (
            insights.map((item, i) => (
              <InsightCard
                key={i}
                index={i}
                title={item.title}
                text={item.text}
              />
            ))
          )}
        </div>
      </Panel>

      {/* Deep breakdown */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel>
          <div className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 shadow-[0_0_22px_rgba(16,185,129,0.16)]">
              <BadgeCheck size={20} strokeWidth={2.6} />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                Strategy Breakdown
              </div>
              <div className="text-sm text-zinc-500">Best and worst setups</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <MiniInsight
              label="Best Strategy"
              value={bestStrategyCard?.tag || "—"}
              sub={
                bestStrategyCard
                  ? `${bestStrategyCard.winRate.toFixed(0)}% win • ${formatK(
                      bestStrategyCard.pnl,
                    )}`
                  : "Not enough data"
              }
              tone="green"
            />

            <MiniInsight
              label="Weakest Strategy"
              value={worstStrategyCard?.tag || "—"}
              sub={
                worstStrategyCard
                  ? `${worstStrategyCard.winRate.toFixed(0)}% win • ${formatK(
                      worstStrategyCard.pnl,
                    )}`
                  : "Not enough data"
              }
              tone="rose"
            />
          </div>

          <div className="mt-4 space-y-3">
            {topThreeStrategies.length === 0 ? (
              <div className="text-sm text-zinc-500">No strategy data</div>
            ) : (
              topThreeStrategies.map((item) => (
                <BarRow
                  key={item.tag}
                  label={item.tag}
                  value={item.winRate}
                  valueText={`${item.winRate.toFixed(0)}%`}
                  sub={`${item.count} trades • ${formatK(item.pnl)}`}
                  tone={item.pnl >= 0 ? "green" : "rose"}
                />
              ))
            )}
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-300 shadow-[0_0_22px_rgba(245,158,11,0.16)]">
              <Coins size={20} strokeWidth={2.6} />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                Symbol Breakdown
              </div>
              <div className="text-sm text-zinc-500">
                Pairs and assets performance
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {topThreeSymbols.length === 0 ? (
              <div className="text-sm text-zinc-500">No symbol data</div>
            ) : (
              topThreeSymbols.map((item) => {
                const width = clamp(
                  (Math.abs(item.pnl) /
                    Math.max(1, Math.abs(topThreeSymbols[0]?.pnl || 1))) *
                    100,
                  6,
                  100,
                );

                return (
                  <div
                    key={item.symbol}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">
                          {item.symbol}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {item.count} trades • {item.winRate.toFixed(0)}% win
                        </div>
                      </div>

                      <div
                        className={`text-sm font-bold ${
                          item.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {formatK(item.pnl)}
                      </div>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className={`h-2 rounded-full ${
                          item.pnl >= 0 ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3 text-lg font-semibold text-white">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/15 text-sky-300 shadow-[0_0_22px_rgba(59,130,246,0.16)]">
              <Globe size={20} strokeWidth={2.6} />
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                Session Breakdown
              </div>
              <div className="text-sm text-zinc-500">
                Asia, London and New York
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {sessionPerf.map((item) => {
              const maxAbs = Math.max(
                1,
                ...sessionPerf.map((s) => Math.abs(s.pnl)),
              );
              const width = (Math.abs(item.pnl) / maxAbs) * 100;

              return (
                <div
                  key={item.name}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">
                        {item.name}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {item.count} trades • {item.winRate.toFixed(0)}% win
                      </div>
                    </div>

                    <div
                      className={`text-sm font-bold ${
                        item.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatK(item.pnl)}
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className={`h-2 rounded-full ${
                        item.pnl >= 0 ? "bg-sky-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${clamp(width, 6, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
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
  iconBg,
  value,
  sub,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
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

  const currentTone = tone ? toneStyles[tone] : toneStyles.blue;

  return (
    <div
      className={[
        "rounded-3xl border p-5 border-white/10 transition-all duration-300",
        currentTone.surface,
        currentTone.glow,
        "hover:-translate-y-1 hover:border-white/15",
      ].join(" ")}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl ${iconBg}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 text-[11px] font-semibold tracking-widest text-zinc-500">
        {title}
      </div>

      <div className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
        {value}
      </div>

      {sub ? (
        <div className="mt-2 text-[11px] sm:text-xs text-zinc-500">{sub}</div>
      ) : null}
    </div>
  );
}

function InsightCard({
  title,
  text,
  index,
}: {
  title: string;
  text: string;
  index: number;
}) {
  const icons = [
    <Target size={18} />,
    <Sparkles size={18} />,
    <Clock size={18} />,
    <Globe size={18} />,
    <AlertTriangle size={18} />,
  ];

  const badges = ["EDGE", "SETUP", "TIMING", "SESSION", "RISK"];

  const styles = [
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    "bg-sky-500/15 text-sky-300 border-sky-500/20",
    "bg-amber-500/15 text-amber-300 border-amber-500/20",
    "bg-purple-500/15 text-purple-300 border-purple-500/20",
    "bg-rose-500/15 text-rose-300 border-rose-500/20",
  ];

  const accent = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
  ];

  const icon = icons[index % icons.length];
  const badge = badges[index % badges.length];
  const iconStyle = styles[index % styles.length];
  const accentLine = accent[index % accent.length];

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/40 p-5",
        "shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[3px] hover:border-white/20 hover:shadow-[0_30px_90px_rgba(0,0,0,0.6)]",
      ].join(" ")}
    >
      {/* left accent line */}
      <div className={`absolute left-0 top-0 h-full w-[3px] ${accentLine}`} />

      {/* hover glow */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-all duration-500 group-hover:opacity-100">
        <div className="absolute -top-10 left-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative flex items-start gap-4">
        {/* icon */}
        <div
          className={`hidden sm:grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconStyle}`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          {/* title + badge */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="text-[13px] font-bold uppercase tracking-wide text-zinc-500">
              {title}
            </div>

            <div
              className={`hidden sm:inline-flex self-start rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider ${iconStyle}`}
            >
              {badge}
            </div>
          </div>

          {/* main insight text */}
          <div className="mt-3 text-[16px] font-medium leading-7 text-zinc-200">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniInsight({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "green" | "rose";
}) {
  return (
    <div
      className={[
        "group relative overflow-hidden rounded-3xl border p-4",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[2px] hover:border-white/15",
        tone === "green"
          ? "border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.08] to-black/20"
          : "border-rose-500/15 bg-gradient-to-b from-rose-500/[0.08] to-black/20",
      ].join(" ")}
    >
      <div className="text-[11px] font-semibold tracking-widest text-zinc-500">
        {label}
      </div>

      <div
        className={[
          "mt-2 text-lg font-bold",
          tone === "green" ? "text-emerald-300" : "text-rose-300",
        ].join(" ")}
      >
        {value}
      </div>

      <div className="mt-1 text-xs text-zinc-400">{sub}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  valueText,
  sub,
  tone,
}: {
  label: string;
  value: number;
  valueText: string;
  sub: string;
  tone: "green" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-all duration-300 hover:bg-black/25 hover:border-white/15">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-white">{label}</div>
          <div className="text-xs text-zinc-500">{sub}</div>
        </div>

        <div
          className={[
            "rounded-xl px-2.5 py-1 text-xs font-bold",
            tone === "green"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300",
          ].join(" ")}
        >
          {valueText}
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={[
            "h-2 rounded-full transition-all duration-500",
            tone === "green" ? "bg-emerald-500" : "bg-rose-500",
          ].join(" ")}
          style={{ width: `${clamp(value, 6, 100)}%` }}
        />
      </div>
    </div>
  );
}
