import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Sparkles, Calendar, TrendingUp, TrendingDown, DollarSign, CheckCircle  } from "lucide-react";

export default function TradeForm() {
  const { user } = useAuthState();
  const navigate = useNavigate();

  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [date, setDate] = useState("");
  const [session, setSession] = useState("Asia");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [result, setResult] = useState<"WIN" | "LOSS" | "BE">("WIN");
  const [pnl, setPnl] = useState("");
  const [equityAfter, setEquityAfter] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [pnlPulseKey, setPnlPulseKey] = useState(0);

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

    setSaving(true);

    const rawPnl = Number(pnl || 0);
    const normalizedPnl =
      result === "WIN"
        ? Math.abs(rawPnl)
        : result === "LOSS"
          ? -Math.abs(rawPnl)
          : 0;

    // normalize symbol for message (keep stored symbol as typed)
    const symForMsg = (symbol || "Trade").toUpperCase().trim() || "Trade";

    try {
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

        tags: tags.split(",").map((t) => t.trim()),
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
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Long / Short segmented control */}
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-1">
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
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                <Field label="QUANTITY">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Lots"
                    className={inputCls}
                    disabled={saving}
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
                    placeholder="Optional"
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
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className={`${inputCls} appearance-none text-white`}
                    disabled={saving}
                  >
                    <option className="bg-zinc-900 text-white">Asia</option>
                    <option className="bg-zinc-900 text-white">London</option>
                    <option className="bg-zinc-900 text-white">New York</option>
                  </select>
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
                          ? "text-emerald-200 border border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.12)]"
                          : result === "LOSS"
                            ? "text-rose-200 border border-rose-500/40 focus:ring-2 focus:ring-rose-500/30 shadow-[0_0_25px_rgba(244,63,94,0.12)]"
                            : "text-zinc-200 border border-zinc-700 focus:ring-2 focus:ring-zinc-600/40",
                      ].join(" ")}
                    />

                    {/* Animated check icon for WIN */}
                    <span
                      className={[
                        "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2",
                        "transition-all duration-300",
                        result === "WIN"
                          ? "opacity-100 scale-100 text-emerald-300"
                          : "opacity-0 scale-90 text-zinc-600",
                      ].join(" ")}
                    >
                      <CheckCircle size={18} strokeWidth={2.6} />
                    </span>
                  </div>
                </Field>

                <Field label="EQUITY AFTER TRADE" className="md:col-span-2">
                  <input
                    type="number"
                    value={equityAfter}
                    onChange={(e) => setEquityAfter(e.target.value)}
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                <Field label="TAGS" className="md:col-span-2">
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Breakout, NY session, Gold"
                    className={inputCls}
                    disabled={saving}
                  />
                </Field>

                {/* <div className="md:col-span-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-zinc-400 hover:bg-white/5"
                    disabled={saving}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-zinc-500">›</span>
                      Pre-Trade Checklist (Optional)
                    </span>
                    <span className="text-zinc-600"> </span>
                  </button>
                </div> */}

                <Field label="NOTES" className="md:col-span-2">
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Trade rationale, entry/exit notes..."
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