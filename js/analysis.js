/* =========================
   js/analysis.js  (SPA VERSION - FULL + SMOOTHER CURVE + AXIS)
   Works with your current SVG using:
   chartFillPos, chartFillNeg, chartLinePos, chartLineNeg, chartLineBal
   ========================= */

import { auth, db } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let allTrades = [];
let rangeKey = "30d";
let filterKey = "all";
let chartMode = "equity"; // equity | drawdown
let unsubscribe = null;

/* -------------------------
   Utilities
------------------------- */

function money(n) {
  const num = Number(n || 0);
  const sign = num >= 0 ? "" : "-";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}
function pct(n) {
  return `${Number(n || 0).toFixed(1)}%`;
}

function setUserUI(user) {
  const name = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const letter = (name?.[0] || "U").toUpperCase();

  $("userName") && ($("userName").textContent = name);
  $("userEmail") && ($("userEmail").textContent = email);
  $("avatar") && ($("avatar").textContent = letter);
}

function setTodayLabel() {
  const el = $("todayLabel");
  if (!el) return;
  const d = new Date();
  el.textContent = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function openMobileMenu() {
  $("sidebar")?.classList.add("open");
  $("overlay")?.classList.add("show");
}
function closeMobileMenu() {
  $("sidebar")?.classList.remove("open");
  $("overlay")?.classList.remove("show");
}

function getTradeDate(t) {
  const cand = t.closedAt || t.exitDate || t.date || t.createdAt;
  if (cand && typeof cand.toDate === "function") return cand.toDate();
  if (typeof cand === "string") {
    const d = new Date(cand);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (cand instanceof Date) return cand;
  return null;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function rangeStart(range) {
  const end = startOfDay(new Date());
  if (range === "today") return end;
  if (range === "7d") {
    const d = new Date(end);
    d.setDate(d.getDate() - 6);
    return d;
  }
  if (range === "30d") {
    const d = new Date(end);
    d.setDate(d.getDate() - 29);
    return d;
  }
  if (range === "3m") {
    const d = new Date(end);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  if (range === "1y") {
    const d = new Date(end);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  return null; // all
}

function applyFilters(trades) {
  const start = rangeStart(rangeKey);

  let out = trades.filter(
    (t) => String(t.status || "closed").toLowerCase() === "closed",
  );

  if (start) {
    out = out.filter((t) => {
      const dt = getTradeDate(t);
      return dt ? startOfDay(dt) >= start : false;
    });
  }

  if (filterKey === "winners") out = out.filter((t) => Number(t.pnl || 0) > 0);
  if (filterKey === "losers") out = out.filter((t) => Number(t.pnl || 0) < 0);

  // sort oldest -> newest so chart is correct
  out.sort(
    (a, b) =>
      (getTradeDate(a)?.getTime() || 0) - (getTradeDate(b)?.getTime() || 0),
  );

  return out;
}

function setActiveChip(groupEl, btn) {
  if (!groupEl || !btn) return;
  groupEl
    .querySelectorAll(".chip")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

/* -------------------------
   Smooth series (reduces sharp zig-zags)
   - Keeps endpoints stable
------------------------- */
function smoothSeries(values, windowSize = 3) {
  const n = values.length;
  if (n < 3) return values.slice();

  const w = Math.max(3, windowSize | 0);
  const half = Math.floor(w / 2);
  const out = new Array(n);

  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n - 1, i + half);
    let sum = 0;
    let cnt = 0;
    for (let j = a; j <= b; j++) {
      sum += values[j];
      cnt++;
    }
    out[i] = cnt ? sum / cnt : values[i];
  }

  // Keep exact endpoints to avoid weird start/end drift
  out[0] = values[0];
  out[n - 1] = values[n - 1];
  return out;
}

/* -------------------------
   Chart helpers
------------------------- */

function svgPoints(values, w = 1000, h = 320) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return values
    .map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function polylineLengthFromPointsStr(pointsStr) {
  if (!pointsStr) return 0;
  const pts = pointsStr
    .trim()
    .split(/\s+/)
    .map((p) => {
      const [x, y] = p.split(",").map(Number);
      return { x, y };
    });
  if (pts.length < 2) return 0;

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function animatePolyline(el, pointsStr, animClass) {
  if (!el) return;

  el.setAttribute("points", pointsStr || "");
  el.classList.remove(animClass);

  // Make corners look smoother visually
  el.style.strokeLinecap = "round";
  el.style.strokeLinejoin = "round";

  const len = polylineLengthFromPointsStr(pointsStr) || 1;
  el.style.strokeDasharray = String(len);
  el.style.strokeDashoffset = String(len);

  void el.getBoundingClientRect();
  el.classList.add(animClass);
}

function pointsToString(pts) {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/**
 * Split by sign (above/below 0) and add intersections on cross.
 * Returns { pos, neg, posFill, negFill } for polylines.
 */
function splitByZero(values, w = 1000, h = 320) {
  if (!values.length) return { pos: "", neg: "", posFill: "", negFill: "" };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const toXY = (v, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = h - ((v - min) / span) * h;
    return { x, y };
  };

  const zeroY = h - ((0 - min) / span) * h;
  const posPts = [];
  const negPts = [];

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const p = toXY(v, i);

    if (i === 0) {
      (v >= 0 ? posPts : negPts).push(p);
      continue;
    }

    const v0 = values[i - 1];
    const p0 = toXY(v0, i - 1);
    const crosses = (v0 >= 0 && v < 0) || (v0 < 0 && v >= 0);

    if (crosses) {
      const t = (0 - v0) / (v - v0); // 0..1
      const xi = p0.x + (p.x - p0.x) * t;
      const pi = { x: xi, y: zeroY };

      if (v0 >= 0) {
        posPts.push(pi);
        negPts.push(pi);
      } else {
        negPts.push(pi);
        posPts.push(pi);
      }

      (v >= 0 ? posPts : negPts).push(p);
    } else {
      (v >= 0 ? posPts : negPts).push(p);
    }
  }

  const posStr = pointsToString(posPts);
  const negStr = pointsToString(negPts);

  const posFill = posStr ? `0,${h} ${posStr} ${w},${h}` : "";
  const negFill = negStr ? `0,${h} ${negStr} ${w},${h}` : "";

  return { pos: posStr, neg: negStr, posFill, negFill };
}

function formatNumber(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function renderAxis(values, label = "Equity") {
  const axis = $("chartAxis");
  if (!axis || !values || values.length < 2) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const mid = (min + max) / 2;

  axis.innerHTML = `
    <span>${formatNumber(max)}</span>
    <span>${formatNumber(mid)}</span>
    <span>${formatNumber(min)}</span>
  `;
}
// Make a smooth curved SVG path using quadratic smoothing
function smoothPath(values, w = 1000, h = 320) {
  if (!values || values.length < 2) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return { x, y };
  });

  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

  const tension = 0.25; // 0 = sharp lines, 1 = very curvy. Try 0.25–0.35

  for (let i = 1; i < pts.length - 1; i++) {
    const xc = pts[i].x + (pts[i + 1].x - pts[i].x) * tension;
    const yc = pts[i].y + (pts[i + 1].y - pts[i].y) * tension;
    d += ` Q ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)} ${xc.toFixed(1)},${yc.toFixed(1)}`;
  }

  d += ` T ${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)}`;
  return d;
}
function fillPathFromLineD(lineD, h = 320) {
  // Convert "M x,y ..." into a closed fill down to bottom
  // Simple approach: extract all coords from the path string
  const coords = lineD.match(/-?\d+(\.\d+)?/g);
  if (!coords || coords.length < 4) return "";

  const firstX = Number(coords[0]);
  const firstY = Number(coords[1]);
  const lastX = Number(coords[coords.length - 2]);
  const lastY = Number(coords[coords.length - 1]);

  // Build a fill polygon-like path
  return `${lineD} L ${lastX.toFixed(1)},${h} L ${firstX.toFixed(1)},${h} Z`;
}

function animatePath(el, d, animClass) {
  if (!el) return;

  el.setAttribute("d", d || "");
  el.classList.remove(animClass);

  // smoother corners
  el.style.strokeLinecap = "round";
  el.style.strokeLinejoin = "round";

  // animate stroke drawing
  const len =
    typeof el.getTotalLength === "function" ? el.getTotalLength() || 1 : 1;
  el.style.strokeDasharray = String(len);
  el.style.strokeDashoffset = String(len);

  void el.getBoundingClientRect();
  el.classList.add(animClass);
}

/* -------------------------
   Metrics + Series
------------------------- */

function calcMetrics(trades) {
  const pnls = trades.map((t) => Number(t.pnl || 0));
  const total = pnls.reduce((a, b) => a + b, 0);

  const wins = pnls.filter((x) => x > 0);
  const losses = pnls.filter((x) => x < 0);
  const breakevens = pnls.filter((x) => x === 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const beCount = breakevens.length;
  const tradeCount = trades.length;

  // Neutral breakeven => win rate uses wins+losses only
  const wlTotal = winCount + lossCount;
  const winRate = wlTotal ? (winCount / wlTotal) * 100 : 0;

  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor =
    grossLossAbs > 0 ? grossProfit / grossLossAbs : grossProfit > 0 ? 99.99 : 0;

  const expectancy = tradeCount ? total / tradeCount : 0;
  const avgWinner = winCount ? grossProfit / winCount : 0;
  const avgLoser = lossCount
    ? losses.reduce((a, b) => a + b, 0) / lossCount
    : 0;

  const bestTrade = tradeCount ? Math.max(...pnls) : 0;
  const worstTrade = tradeCount ? Math.min(...pnls) : 0;

  let bestWinStreak = 0,
    bestLossStreak = 0;
  let curWin = 0,
    curLoss = 0;
  for (const p of pnls) {
    if (p > 0) {
      curWin++;
      curLoss = 0;
    } else if (p < 0) {
      curLoss++;
      curWin = 0;
    } else {
      curWin = 0;
      curLoss = 0;
    }
    bestWinStreak = Math.max(bestWinStreak, curWin);
    bestLossStreak = Math.max(bestLossStreak, curLoss);
  }

  const riskReward =
    avgWinner > 0 && avgLoser < 0 ? avgWinner / Math.abs(avgLoser) : 0;

  // Long / Short stats
  const longArr = trades.filter(
    (t) => String(t.side || "").toLowerCase() === "long",
  );
  const shortArr = trades.filter(
    (t) => String(t.side || "").toLowerCase() === "short",
  );

  const dirStats = (arr) => {
    const ps = arr.map((t) => Number(t.pnl || 0));
    const tot = ps.reduce((a, b) => a + b, 0);
    const w = ps.filter((x) => x > 0).length;
    const l = ps.filter((x) => x < 0).length;
    const wl = w + l;
    return { trades: ps.length, pnl: tot, winRate: wl ? (w / wl) * 100 : 0 };
  };

  // Day sum (Mon..Sun)
  const daySum = Array(7).fill(0);
  trades.forEach((t) => {
    const dt = getTradeDate(t);
    if (!dt) return;
    const jsDay = dt.getDay(); // Sun=0..Sat=6
    const idx = (jsDay + 6) % 7; // Mon=0..Sun=6
    daySum[idx] += Number(t.pnl || 0);
  });

  return {
    total,
    tradeCount,
    winRate,
    winCount,
    lossCount,
    beCount,
    profitFactor,
    expectancy,
    avgWinner,
    avgLoser,
    bestTrade,
    worstTrade,
    bestWinStreak,
    bestLossStreak,
    riskReward,
    long: dirStats(longArr),
    short: dirStats(shortArr),
    daySum,
  };
}

function buildSeries(trades) {
  // Prefer actual equityAfter if available
  const equity = [];
  const equityAfterValues = trades
    .map((t) => Number(t.equityAfter))
    .filter((v) => !Number.isNaN(v));

  const hasEquityAfter =
    equityAfterValues.length === trades.length && trades.length > 0;

  if (hasEquityAfter) {
    // actual account equity line
    trades.forEach((t) => equity.push(Number(t.equityAfter)));
  } else {
    // fallback: cumulative pnl (still works)
    let cum = 0;
    trades.forEach((t) => {
      cum += Number(t.pnl || 0);
      equity.push(cum);
    });
  }

  // drawdown from equity curve
  const drawdown = [];
  let peak = -Infinity;
  for (const v of equity) {
    peak = Math.max(peak, v);
    drawdown.push(v - peak);
  }

  // optional overlay: balance (same as equity if actual equityAfter exists)
  // We'll show overlay only if equityAfter exists, otherwise hide.
  const balance = hasEquityAfter ? equity.slice() : [];

  return { equity, drawdown, balance, hasEquityAfter };
}

/* -------------------------
   Day Performance (Animated bars)
------------------------- */

function renderDayPerformance(daySum) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const maxAbs = Math.max(1, ...daySum.map((v) => Math.abs(v)));

  const html = names
    .map((n, i) => {
      const v = daySum[i] || 0;
      const pctW = Math.round((Math.abs(v) / maxAbs) * 100);
      const color =
        v > 0
          ? "rgba(90,255,150,.55)"
          : v < 0
            ? "rgba(255,90,90,.55)"
            : "rgba(43,123,255,.25)";

      const fill = `<div class="day-fill" style="--w:${pctW}%; background:${color};"></div>`;

      return `
      <div class="day-row">
        <div class="day-name muted">${n}</div>
        <div class="day-bar">${fill}</div>
        <div class="day-val ${v < 0 ? "red" : "blueText"}">${money(v)}</div>
      </div>
    `;
    })
    .join("");

  const dayList = $("dayList");
  if (!dayList) return;

  dayList.innerHTML = html;
  dayList.classList.remove("day-animate");
  void dayList.getBoundingClientRect();
  requestAnimationFrame(() => dayList.classList.add("day-animate"));
}

/* -------------------------
   Paint UI (FULL)
------------------------- */

function paintUI(trades) {
  const m = calcMetrics(trades);

  $("totalPnl") && ($("totalPnl").textContent = money(m.total));
  $("totalPnlSub") &&
    ($("totalPnlSub").textContent = `From ${m.tradeCount} closed trades`);

  $("winRate") && ($("winRate").textContent = pct(m.winRate));

  const winRateSub = $("winRateSub");
  if (winRateSub) {
    let html = `${m.winCount} wins • ${m.lossCount} losses`;
    if (m.beCount) {
      html += ` • <span class="be-dot"></span> <span class="be-text">${m.beCount} breakeven</span>`;
    }
    winRateSub.innerHTML = html;
  }

  $("profitFactor") &&
    ($("profitFactor").textContent = m.profitFactor.toFixed(2));
  $("expectancy") && ($("expectancy").textContent = money(m.expectancy));

  $("avgWinner") && ($("avgWinner").textContent = money(m.avgWinner));
  $("avgLoser") && ($("avgLoser").textContent = money(m.avgLoser));
  $("bestTrade") && ($("bestTrade").textContent = money(m.bestTrade));
  $("worstTrade") && ($("worstTrade").textContent = money(m.worstTrade));
  $("winStreak") && ($("winStreak").textContent = `${m.bestWinStreak} trades`);
  $("lossStreak") &&
    ($("lossStreak").textContent = `${m.bestLossStreak} trades`);
  $("riskReward") && ($("riskReward").textContent = m.riskReward.toFixed(2));

  $("longTrades") && ($("longTrades").textContent = m.long.trades);
  $("longPnl") && ($("longPnl").textContent = money(m.long.pnl));
  $("longWin") && ($("longWin").textContent = pct(m.long.winRate));

  $("shortTrades") && ($("shortTrades").textContent = m.short.trades);
  $("shortPnl") && ($("shortPnl").textContent = money(m.short.pnl));
  $("shortWin") && ($("shortWin").textContent = pct(m.short.winRate));

  renderDayPerformance(m.daySum);

  // ===== Chart (Smooth + Actual Equity Axis) =====
  const { equity, drawdown, balance, hasEquityAfter } = buildSeries(trades);

  const values = equity; // drawdown removed
  const empty = values.length < 2;

  $("chartEmpty") && ($("chartEmpty").style.display = empty ? "grid" : "none");
  $("chart") && ($("chart").style.opacity = empty ? "0.35" : "1");

  // Axis should show ACTUAL equity numbers when in equity mode and equityAfter exists
  if (chartMode === "equity" && hasEquityAfter) renderAxis(equity, "Equity");
  else if (chartMode === "drawdown") renderAxis(drawdown, "Drawdown");
  else renderAxis(values);

  const lineEl = $("chartLine");
  const fillEl = $("chartFill");
  const balEl = $("chartLineBal");

  if (empty) {
    lineEl && lineEl.setAttribute("d", "");
    fillEl && fillEl.setAttribute("d", "");
    balEl && balEl.setAttribute("d", "");
  } else {
    const d = smoothPath(values);
    animatePath(lineEl, d, "chart-anim");

    const fd = fillPathFromLineD(d);
    if (fillEl) {
      fillEl.setAttribute("d", fd || "");
      fillEl.classList.remove("chart-fill-anim");
      void fillEl.getBoundingClientRect();
      fillEl.classList.add("chart-fill-anim");
    }

    // Overlay only in equity mode AND only if we have real equityAfter
    if (balEl) {
      if (chartMode === "equity" && hasEquityAfter && balance.length >= 2) {
        const bd = smoothPath(balance);
        animatePath(balEl, bd, "chart-anim");
        balEl.style.display = "";
      } else {
        balEl.setAttribute("d", "");
        balEl.style.display = "none";
      }
    }
  }

  $("chartNote") &&
    ($("chartNote").textContent = hasEquityAfter
      ? "Account Equity (actual) • smooth curve"
      : "Cumulative P&L (fallback) • smooth curve");
}

/* -------------------------
   Firestore
------------------------- */

function watchTrades(uid) {
  const ref = collection(db, "users", uid, "trades");
  const qy = query(ref, orderBy("closedAt", "asc"));

  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(qy, (snap) => {
    const arr = [];
    snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
    allTrades = arr;

    const filtered = applyFilters(allTrades);
    paintUI(filtered);
  });
}

/* =========================
   SPA INIT
========================= */

export async function init(user) {
  const ac = new AbortController();
  const { signal } = ac;

  setUserUI(user);
  setTodayLabel();

  // $("collapseBtn")?.addEventListener(
  //   "click",
  //   () => $("sidebar")?.classList.toggle("collapsed"),
  //   { signal },
  // );

  $("menuBtn")?.addEventListener("click", openMobileMenu, { signal });
  $("overlay")?.addEventListener("click", closeMobileMenu, { signal });

  $("logoutBtn")?.addEventListener(
    "click",
    async () => {
      await signOut(auth);
      window.location.href = "index.html";
    },
    { signal },
  );

  // TIME PERIOD chips
  $("timeChips")?.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      rangeKey = btn.dataset.range;
      setActiveChip($("timeChips"), btn);
      paintUI(applyFilters(allTrades));
    },
    { signal },
  );

  // FILTER chips
  $("filterChips")?.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      filterKey = btn.dataset.filter;
      setActiveChip($("filterChips"), btn);
      paintUI(applyFilters(allTrades));
    },
    { signal },
  );

  // chart toggle
  $("btnEquity")?.addEventListener(
    "click",
    () => {
      chartMode = "equity";
      $("btnEquity")?.classList.add("active");
      $("btnDrawdown")?.classList.remove("active");
      paintUI(applyFilters(allTrades));
    },
    { signal },
  );

  watchTrades(user.uid);

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {}
      unsubscribe = null;
    }
    ac.abort();
  };
}
