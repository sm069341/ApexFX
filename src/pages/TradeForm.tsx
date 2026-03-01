import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuthState } from "../hooks/useAuthState";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  Plus,
  X,
  BadgeCheck,
  BadgeX,
  MinusCircle,
} from "lucide-react";

type TradeFormProps = {
  mode: "create" | "edit";
};

export default function TradeForm({ mode }: TradeFormProps) {
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Premium preview (what will be saved)
  const pnlPreview = useMemo(() => {
    const raw = Number(pnl || 0);
    if (!Number.isFinite(raw)) return 0;
    if (result === "WIN") return Math.abs(raw);
    if (result === "LOSS") return -Math.abs(raw);
    return 0;
  }, [pnl, result]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const rawPnl = Number(pnl || 0);
    const normalizedPnl =
      result === "WIN"
        ? Math.abs(rawPnl)
        : result === "LOSS"
          ? -Math.abs(rawPnl)
          : 0;

    await addDoc(collection(db, "trades"), {
      uid: user.uid,

      // ✅ consistent names everywhere
      side: side === "LONG" ? "BUY" : "SELL",
      entryDate: date, // YYYY-MM-DD

      session,
      symbol: (symbol || "").toUpperCase().replace(/\s+/g, ""),
      quantity: Number(quantity),
      entryPrice: Number(entryPrice),
      exitPrice: Number(exitPrice),

      result,
      pnl: normalizedPnl,
      equityAfter: Number(equityAfter),

      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes,

      createdAt: Timestamp.now(),
    });

    navigate("/");
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-8">
      <div className="min-h-full flex items-center justify-center">
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950/60 shadow-[0_30px_100px_rgba(0,0,0,0.75)]">
          {/* soft glow */}
          <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_60%_at_20%_0%,rgba(59,130,246,0.20),transparent_60%),radial-gradient(55%_55%_at_90%_0%,rgba(255,255,255,0.06),transparent_55%)]" />

          <div className="relative p-5 sm:p-6 md:p-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-2xl bg-sky-600/15 text-sky-300">
                  <Plus size={22} strokeWidth={2.8} />
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-white">
                    {mode === "edit" ? "Edit Trade" : "Add Trade"}
                  </h2>
                </div>
              </div>

              <button
                onClick={() => navigate(-1)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={18} strokeWidth={2.8} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Long / Short segmented control */}
              <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSide("LONG")}
                    className={[
                      "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      side === "LONG"
                        ? "bg-blue-600/25 text-blue-300 shadow-[0_0_20px_rgba(37,99,235,0.35)] border border-blue-500/30"
                        : "text-zinc-400 hover:bg-zinc-800/40",
                    ].join(" ")}
                  >
                    <ArrowUpRight
                      size={18}
                      strokeWidth={2.8}
                      className="opacity-90"
                    />
                    Long
                  </button>

                  <button
                    type="button"
                    onClick={() => setSide("SHORT")}
                    className={[
                      "flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition",
                      side === "SHORT"
                        ? "bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.25)]"
                        : "text-zinc-400 hover:bg-zinc-800/40",
                    ].join(" ")}
                  >
                    <ArrowDownRight
                      size={18}
                      strokeWidth={2.8}
                      className="opacity-90"
                    />
                    Short
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* SYMBOL */}
                <Field label="SYMBOL">
                  <input
                    value={symbol}
                    onChange={(e) =>
                      setSymbol(
                        e.target.value.toUpperCase().replace(/\s+/g, ""),
                      )
                    }
                    placeholder="E.G. XAUUSD"
                    className={inputCls}
                  />
                </Field>

                {/* QUANTITY */}
                <Field label="QUANTITY">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Lots"
                    className={inputCls}
                  />
                </Field>

                {/* ENTRY PRICE */}
                <Field label="ENTRY PRICE">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.00001"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                </Field>

                {/* EXIT PRICE */}
                <Field label="EXIT PRICE">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.00001"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </Field>

                {/* ENTRY DATE */}
                <Field label="ENTRY DATE">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      <CalendarDays size={18} strokeWidth={2.6} />
                    </span>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className={[inputCls, "pl-10"].join(" ")}
                    />
                  </div>
                </Field>

                {/* Session */}
                <Field label="SESSION">
                  <select
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className={`${inputCls} appearance-none text-white`}
                  >
                    <option className="bg-zinc-900 text-white">Asia</option>
                    <option className="bg-zinc-900 text-white">London</option>
                    <option className="bg-zinc-900 text-white">New York</option>
                  </select>
                </Field>

                {/* Result + PnL */}
                <Field label="RESULT" className="md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {(["WIN", "LOSS", "BE"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setResult(r)}
                        className={[
                          "rounded-2xl px-4 py-2 text-sm font-semibold transition",
                          result === r
                            ? r === "WIN"
                              ? "bg-blue-600/25 text-blue-300 border border-blue-500/40 shadow-[0_0_20px_rgba(37,99,235,0.35)]"
                              : r === "LOSS"
                                ? "bg-rose-600/20 text-rose-300 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.25)]"
                                : "bg-slate-600/30 text-slate-200 border border-slate-400/40"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10",
                        ].join(" ")}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* premium preview chip */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="text-xs text-zinc-500">Preview:</div>
                    <div
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums",
                        pnlPreview > 0
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : pnlPreview < 0
                            ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                            : "border-slate-400/20 bg-white/5 text-zinc-300",
                      ].join(" ")}
                      title={`${pnlPreview >= 0 ? "+" : "-"}$${Math.abs(pnlPreview).toFixed(2)}`}
                    >
                      {pnlPreview > 0 ? (
                        <BadgeCheck size={14} strokeWidth={2.6} />
                      ) : null}
                      {pnlPreview < 0 ? (
                        <BadgeX size={14} strokeWidth={2.6} />
                      ) : null}
                      {pnlPreview === 0 ? (
                        <MinusCircle size={14} strokeWidth={2.6} />
                      ) : null}
                      {pnlPreview >= 0 ? "+" : "-"}$
                      {Math.abs(pnlPreview).toFixed(2)}
                    </div>
                  </div>

                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="Enter PnL"
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    className={["mt-3", inputCls].join(" ")}
                  />
                </Field>

                {/* Equity */}
                <Field label="EQUITY AFTER TRADE" className="md:col-span-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={equityAfter}
                    onChange={(e) => setEquityAfter(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                {/* Tags */}
                <Field label="TAGS" className="md:col-span-2">
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Breakout, NY session, Gold"
                    className={inputCls}
                  />
                </Field>

                {/* Pre-Trade checklist (visual only) */}
                <div className="md:col-span-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-4 text-sm text-zinc-400 hover:bg-white/5"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-zinc-500">›</span>
                      Pre-Trade Checklist (Optional)
                    </span>
                    <span className="text-zinc-600"> </span>
                  </button>
                </div>

                {/* Notes */}
                <Field label="NOTES" className="md:col-span-2">
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Trade rationale, entry/exit notes..."
                    className={[inputCls, "resize-none py-3"].join(" ")}
                  />
                </Field>
              </div>

              {/* Footer buttons */}
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-blue-600 px-7 py-3 text-sm font-semibold text-white hover:bg-blue-500"
                >
                  Save Trade
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
   Small UI helpers (only UI)
========================= */

const inputCls =
  "mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20";

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
