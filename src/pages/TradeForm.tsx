import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { motion } from "framer-motion";
import { useAuthState } from "../hooks/useAuthState";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Sparkles,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle,
  X,
  CircleDot,
  XCircle,
  ChevronDown,
  Check,
} from "lucide-react";

export default function TradeForm() {
  const { user } = useAuthState();
  const navigate = useNavigate();

  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [date, setDate] = useState("");
  // const sessions = ["Asia", "London", "New York"];
  const [session, setSession] = useState("");
  const [setSessionOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [result, setResult] = useState<"WIN" | "LOSS" | "BE">("WIN");
  const [pnl, setPnl] = useState("");
  const [pips, setPips] = useState("");
  const [equityAfter] = useState("");
  const strategies = [
    "A+",
    "TJL-1",
    "TJL-2",
    "SBR",
    "RBS",
    "5Wave Choch",
    "Dual Choch",
  ];
  const timeframes = ["1m", "5m", "15m", "1h", "4h", "1D"];

  const [strategy, setStrategy] = useState("");
  const [timeframe, setTimeframe] = useState("");

  const [strategyOpen, setStrategyOpen] = useState(false);
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [pnlPulseKey, setPnlPulseKey] = useState(0);

  const [missing, setMissing] = useState<string[]>([]);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // pulse only for WIN/LOSS (not BE)
    if (result === "WIN" || result === "LOSS") setPnlPulseKey((k) => k + 1);
  }, [result]);

  // ✅ new states
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successSymbol, setSuccessSymbol] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;

    if (!strategy || !timeframe) {
      alert("Please select strategy and timeframe.");
      return;
    }

    const errors: string[] = [];

    if (!date) errors.push("date");
    if (!session) errors.push("session");
    if (!symbol) errors.push("symbol");
    if (!quantity) errors.push("quantity");
    if (!entryPrice) errors.push("entryPrice");
    if (!exitPrice) errors.push("exitPrice");
    if (!result) errors.push("result");
    if (!pnl) errors.push("pnl");
    if (!pips) errors.push("pips");
    if (!strategy) errors.push("strategy");
    if (!timeframe) errors.push("timeframe");

    setMissing(errors);

    if (errors.length > 0) {
      setMissing(errors);

      setShake(true);
      setTimeout(() => setShake(false), 400);

      return;
    }
    setSaving(true);

    // normalize symbol for message (keep stored symbol as typed)
    const symForMsg = (symbol || "Trade").toUpperCase().trim() || "Trade";

    try {
      const pnlValue = Number(pnl || 0);

      const normalizedPnl =
        result === "WIN"
          ? Math.abs(pnlValue)
          : result === "LOSS"
            ? -Math.abs(pnlValue)
            : 0;

      const pipValue = Number(pips || 0);

      const normalizedPips =
        result === "WIN"
          ? Math.abs(pipValue)
          : result === "LOSS"
            ? -Math.abs(pipValue)
            : 0;

      await addDoc(collection(db, "trades"), {
        uid: user.uid,

        side: side === "LONG" ? "BUY" : "SELL",
        entryDate: date,

        session,
        symbol: symbol.trim().toUpperCase(),
        quantity: Number(quantity),
        entryPrice: Number(entryPrice),
        exitPrice: Number(exitPrice),

        result,
        pnl: normalizedPnl,
        equityAfter: Number(equityAfter),

        // ✅ ONLY THIS
        pips: normalizedPips,

        tags: strategy && timeframe ? [`${strategy} ${timeframe}`] : [],
        notes,

        createdAt: Timestamp.now(),
      });

      // ✅ success overlay
      setSuccessSymbol(symForMsg);
      setSuccess(true);

      // ✅ smooth auto close
      setTimeout(() => {
        navigate(-1);
      }, 1100);
    } catch (err) {
      console.error("Add trade failed:", err);
      alert("Failed to save trade. Check console (F12).");
      setSaving(false);
      setSuccess(false);
    }
  }

  const isError = (field: string) => missing.includes(field);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8">
      <div className="min-h-full flex items-center justify-center">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/10 bg-zinc-950/60 shadow-[0_30px_100px_rgba(0,0,0,0.75)]">
          {/* soft glow */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-70 animate-[pulse_3.5s_ease-in-out_infinite] [background:radial-gradient(60%_60%_at_20%_0%,rgba(59,130,246,0.22),transparent_60%),radial-gradient(55%_55%_at_90%_0%,rgba(255,255,255,0.08),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.10] [background-image:radial-gradient(rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:18px_18px]" />

          {/* ✅ success overlay */}
          {success && (
            <div className="absolute inset-0 z-20 rounded-[32px] border border-emerald-500/20 bg-zinc-950/55 backdrop-blur-sm">
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-300 animate-[softPop_.25s_ease-out]">
                  {/* check icon */}
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="stroke-current"
                  >
                    <path
                      d="M20 6L9 17l-5-5"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="mt-4 text-xl font-semibold text-white animate-[fadeUp_.25s_ease-out]">
                  {successSymbol} added successfully ✅
                </div>
                <div className="mt-1 text-sm text-zinc-400 animate-[fadeUp_.25s_ease-out]">
                  Updating your journal…
                </div>

                <div className="mt-5 h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-full origin-left animate-[progress_1.1s_ease-out_forwards] rounded-full bg-emerald-500/70" />
                </div>
              </div>
            </div>
          )}

          <div className="relative p-6 md:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-600/15 text-sky-300 transition-all duration-300 hover:scale-105 hover:bg-sky-600/20 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)] animate-[softPop_.35s_ease-out]">
                  <Sparkles size={26} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white">
                    Add Trade
                  </h2>
                </div>
              </div>

              <button
                onClick={() => navigate(-1)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                aria-label="Close"
                disabled={saving}
              >
                <X size={28} strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={shake ? "shake" : ""}>
              {/* Long / Short segmented control */}
              <div className="mb-6 relative rounded-2xl border border-white/10 bg-white/5 p-1">
                <div
                  className={`absolute top-1 bottom-1 w-1/2 rounded-2xl transition-all duration-300 ease-out
    ${side === "LONG" ? "left-1 bg-emerald-600/15" : "left-1/2 bg-rose-600/15"}
  `}
                />
                <div className="grid grid-cols-2 gap-1">
                  {/* LONG */}
                  <button
                    type="button"
                    onClick={() => setSide("LONG")}
                    disabled={saving}
                    className={[
                      "group relative flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold",
                      "transition-all duration-300 ease-out",
                      side === "LONG"
                        ? "bg-emerald-600/15 text-emerald-200 border border-emerald-500/35"
                        : "text-zinc-400 hover:bg-zinc-800/40",
                      saving ? "opacity-70" : "",
                    ].join(" ")}
                  >
                    {/* subtle pulse glow when active */}
                    {side === "LONG" && (
                      <span className="pointer-events-none absolute inset-0 rounded-2xl animate-[glowGreen_2.2s_ease-in-out_infinite]" />
                    )}

                    <span className="relative z-10 flex items-center gap-2">
                      <TrendingUp
                        size={18}
                        strokeWidth={2.6}
                        className={[
                          "transition-transform duration-300",
                          side === "LONG"
                            ? "animate-[arrowNudgeUp_.9s_ease-in-out_infinite]"
                            : "group-hover:-translate-y-[1px]",
                        ].join(" ")}
                      />
                      <span>Long</span>
                    </span>
                  </button>

                  {/* SHORT */}
                  <button
                    type="button"
                    onClick={() => setSide("SHORT")}
                    disabled={saving}
                    className={[
                      "group relative flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold",
                      "transition-all duration-300 ease-out",
                      side === "SHORT"
                        ? "bg-rose-600/15 text-rose-200 border border-rose-500/35"
                        : "text-zinc-400 hover:bg-zinc-800/40",
                      saving ? "opacity-70" : "",
                    ].join(" ")}
                  >
                    {/* subtle pulse glow when active */}
                    {side === "SHORT" && (
                      <span className="pointer-events-none absolute inset-0 rounded-2xl animate-[glowRed_2.2s_ease-in-out_infinite]" />
                    )}

                    <span className="relative z-10 flex items-center gap-2">
                      <TrendingDown
                        size={18}
                        strokeWidth={2.6}
                        className={[
                          "transition-transform duration-300",
                          side === "SHORT"
                            ? "animate-[arrowNudgeDown_.9s_ease-in-out_infinite]"
                            : "group-hover:translate-y-[1px]",
                        ].join(" ")}
                      />
                      <span>Short</span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="SYMBOL">
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="E.G. XAUUSD"
                    className={`${inputCls} ${
                      isError("symbol")
                        ? "border-red-500/70 ring-1 ring-red-500/30"
                        : ""
                    }`}
                  />
                </Field>

                <Field label="QUANTITY">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Lots"
                    className={`${inputCls} ${
                      isError("quantity")
                        ? "border-red-500/70 ring-1 ring-red-500/30"
                        : ""
                    }`}
                  />
                </Field>

                <Field label="ENTRY PRICE">
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                <Field label="EXIT PRICE">
                  <input
                    type="number"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                <Field label="ENTRY DATE">
                  <div className="relative group">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-all duration-200 group-focus-within:text-sky-400 group-focus-within:scale-105">
                      <Calendar size={18} strokeWidth={2.2} />
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={[inputCls, "pl-10"].join(" ")}
                      disabled={saving}
                    />
                  </div>
                </Field>

                <Field label="SESSION">
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {["Asian", "London", "New York"].map((item) => (
                      <motion.button
                        key={item}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => setSession(item)}
                        className={`rounded-xl py-2.5 text-xs font-medium transition-all duration-300 border
          ${
            session === item
              ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.10)]"
              : "border-white/10 bg-[#121216] text-gray-500 hover:text-gray-300"
          }`}
                      >
                        {item}
                      </motion.button>
                    ))}
                  </div>
                </Field>

                <Field label="RESULT" className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {["WIN", "LOSS", "BE"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setResult(r as any)}
                        disabled={saving}
                        className={[
                          "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                          result === r
                            ? r === "WIN"
                              ? "bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                              : r === "LOSS"
                                ? "bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                                : "bg-slate-600/30 text-slate-200 border border-slate-400/40"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10",
                          saving ? "opacity-70" : "",
                        ].join(" ")}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  <div
                    key={pnlPulseKey}
                    className={[
                      "mt-3 relative",
                      result === "WIN"
                        ? "animate-[pnlPulseGreen_.45s_ease-out]"
                        : result === "LOSS"
                          ? "animate-[pnlPulseRed_.45s_ease-out]"
                          : "",
                    ].join(" ")}
                  >
                    {/* $ icon */}
                    <span
                      className={[
                        "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
                        "transition-colors duration-300",
                        result === "WIN"
                          ? "text-emerald-300"
                          : result === "LOSS"
                            ? "text-rose-300"
                            : "text-zinc-500",
                      ].join(" ")}
                    >
                      <DollarSign size={18} strokeWidth={2.6} />
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Enter PnL"
                      value={pnl}
                      onChange={(e) => {
                        const value = e.target.value;
                        const clean = value.replace("-", "");
                        setPnl(clean);
                      }}
                      className={[
                        "w-full rounded-2xl px-4 py-3 pl-10 pr-10 text-sm outline-none transition-all duration-300 ease-out",
                        "bg-zinc-900/60",

                        result === "WIN"
                          ? "text-emerald-200 border border-emerald-500/40 focus:ring-emerald-500/30 animate-[pnlGlowGreen_.6s_ease-out]"
                          : result === "LOSS"
                            ? "text-rose-200 border border-rose-500/40 focus:ring-rose-500/30 animate-[pnlGlowRed_.6s_ease-out]"
                            : "text-zinc-200 border border-zinc-700 focus:ring-zinc-600/40",
                      ].join(" ")}
                    />

                    {/* Animated check icon for WIN */}
                    <span
                      key={result}
                      className={[
                        "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2",
                        "transition-all duration-300",
                        result
                          ? "opacity-100 animate-[resultIconPop_.4s_cubic-bezier(.22,1,.36,1)]"
                          : "opacity-0 scale-90",
                        result === "WIN"
                          ? "text-emerald-300"
                          : result === "LOSS"
                            ? "text-rose-300"
                            : "text-zinc-400",
                      ].join(" ")}
                    >
                      {result === "WIN" && (
                        <CheckCircle size={20} strokeWidth={2.6} />
                      )}
                      {result === "LOSS" && (
                        <XCircle size={20} strokeWidth={2.6} />
                      )}
                      {result === "BE" && (
                        <CircleDot size={20} strokeWidth={2.6} />
                      )}
                    </span>
                  </div>
                </Field>

                <Field label="PIPS" className="md:col-span-2">
                  <div
                    className={[
                      `flex h-11 items-center rounded-xl border px-4 transition-all duration-200 bg-[#121216]
  ${isError("pips") ? "border-red-500/70 ring-1 ring-red-500/30" : "border-white/10"}`,
                      result === "WIN"
                        ? "border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                        : result === "LOSS"
                          ? "border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                          : "border-white/10",
                    ].join(" ")}
                  >
                    {/* PREFIX */}
                    <span
                      className={[
                        "text-sm font-bold mr-2 transition-colors",
                        result === "WIN"
                          ? "text-emerald-400"
                          : result === "LOSS"
                            ? "text-rose-400"
                            : "text-gray-500",
                      ].join(" ")}
                    >
                      <i>P</i>
                    </span>

                    {/* INPUT */}
                    <input
                      type="number"
                      placeholder="Enter Pips"
                      value={pips}
                      onChange={(e) => setPips(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                      disabled={saving}
                    />

                    {/* SUFFIX */}
                    <span className="text-xs font-medium text-gray-500 ml-2">
                      pips
                    </span>
                  </div>
                </Field>

                <Field label="TAGS" className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!saving) {
                            setStrategyOpen((v) => !v);
                            setTimeframeOpen(false);
                            // setSessionOpen(false);
                          }
                        }}
                        disabled={saving}
                        className={[
                          `w-full rounded-2xl border px-4 py-3 pr-10 text-left text-sm
bg-zinc-900/60
${isError("strategy") ? "border-red-500/70 ring-1 ring-red-500/30" : "border-zinc-700"}`,
                          "focus:ring-2 focus:ring-zinc-600/40",
                          strategy ? "text-white" : "text-zinc-500",
                          saving ? "opacity-70 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {strategy || "Select strategy"}
                      </button>

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                        <ChevronDown
                          size={18}
                          className={`transition-transform duration-200 ${strategyOpen ? "rotate-180" : ""}`}
                        />
                      </span>

                      {strategyOpen && (
                        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
                          {strategies.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                setStrategy(item);
                                setStrategyOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between px-4 py-3 text-sm transition",
                                "text-zinc-200 hover:bg-white/5",
                                strategy === item ? "bg-white/5" : "",
                              ].join(" ")}
                            >
                              <span>{item}</span>
                              {strategy === item && (
                                <Check size={16} className="text-emerald-300" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (!saving) {
                            setTimeframeOpen((v) => !v);
                            setStrategyOpen(false);
                            // setSessionOpen(false);
                          }
                        }}
                        disabled={saving}
                        className={[
                          `w-full rounded-2xl border px-4 py-3 pr-10 text-left text-sm
                          bg-zinc-900/60
                          ${isError("timeframe") ? "border-red-500/70 ring-1 ring-red-500/30" : "border-zinc-700"}`,
                          "bg-zinc-900/60 border-zinc-700 hover:bg-zinc-900/80",
                          "focus:ring-2 focus:ring-zinc-600/40",
                          timeframe ? "text-white" : "text-zinc-500",
                          saving ? "opacity-70 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        {timeframe || "Select timeframe"}
                      </button>

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                        <ChevronDown
                          size={18}
                          className={`transition-transform duration-200 ${timeframeOpen ? "rotate-180" : ""}`}
                        />
                      </span>

                      {timeframeOpen && (
                        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
                          {timeframes.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                setTimeframe(item);
                                setTimeframeOpen(false);
                              }}
                              className={[
                                "flex w-full items-center justify-between px-4 py-3 text-sm transition",
                                "text-zinc-200 hover:bg-white/5",
                                timeframe === item ? "bg-white/5" : "",
                              ].join(" ")}
                            >
                              <span>{item}</span>
                              {timeframe === item && (
                                <Check size={16} className="text-emerald-300" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Field>

                <Field label="NOTES / TRADE MISTAKES" className="md:col-span-2">
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What went wrong? Psychology, entry mistake, early exit, risk issue..."
                    className={[inputCls, "resize-none py-3"].join(" ")}
                    disabled={saving}
                  />
                </Field>
              </div>

              {/* Footer buttons */}
              <div className="mt-7 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || success}
                  className={[
                    "rounded-2xl px-7 py-3 text-sm font-semibold transition-all duration-300 ease-out",
                    saving || success
                      ? "bg-zinc-700 text-zinc-300 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-[1px] hover:shadow-lg active:scale-[0.98]",
                  ].join(" ")}
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Saving…
                    </span>
                  ) : (
                    "Save Trade"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Small UI helpers
========================= */

const inputCls =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20 disabled:opacity-60";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold tracking-widest text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}
