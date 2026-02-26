import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let allTrades = [];
let rangeKey = "30d";
let filterKey = "all";
let chartMode = "equity"; // equity | drawdown
let unsubscribe = null;

function money(n){
  const num = Number(n || 0);
  const sign = num >= 0 ? "" : "-";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}
function pct(n){ return `${Number(n||0).toFixed(1)}%`; }

function setUserUI(user){
  const name = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const letter = (name?.[0] || "U").toUpperCase();
  $("userName").textContent = name;
  $("userEmail").textContent = email;
  $("avatar").textContent = letter;
  $("topAvatar").textContent = letter;
}
function setTodayLabel(){
  const d = new Date();
  $("todayLabel").textContent = d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
}

function openMobileMenu(){ $("sidebar").classList.add("open"); $("overlay").classList.add("show"); }
function closeMobileMenu(){ $("sidebar").classList.remove("open"); $("overlay").classList.remove("show"); }

function getTradeDate(t){
  const cand = t.closedAt || t.exitDate || t.date || t.createdAt;
  if (cand && typeof cand.toDate === "function") return cand.toDate();
  if (typeof cand === "string"){
    const d = new Date(cand);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (cand instanceof Date) return cand;
  return null;
}

function startOfDay(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

function rangeStart(range){
  const now = new Date();
  const end = startOfDay(now);
  if (range === "today") return end;
  if (range === "7d") { const d = new Date(end); d.setDate(d.getDate()-6); return d; }
  if (range === "30d"){ const d = new Date(end); d.setDate(d.getDate()-29); return d; }
  if (range === "3m") { const d = new Date(end); d.setMonth(d.getMonth()-3); return d; }
  if (range === "1y") { const d = new Date(end); d.setFullYear(d.getFullYear()-1); return d; }
  return null; // all
}

function applyFilters(trades){
  const start = rangeStart(rangeKey);
  let out = trades.filter(t => String(t.status || "closed").toLowerCase() === "closed");

  if (start){
    out = out.filter(t => {
      const dt = getTradeDate(t);
      return dt ? startOfDay(dt) >= start : false;
    });
  }

  if (filterKey === "winners") out = out.filter(t => Number(t.pnl||0) > 0);
  if (filterKey === "losers") out = out.filter(t => Number(t.pnl||0) < 0);

  // sort by date asc for streak + charts
  out.sort((a,b) => (getTradeDate(a)?.getTime()||0) - (getTradeDate(b)?.getTime()||0));
  return out;
}

function calcMetrics(trades){
  const pnls = trades.map(t => Number(t.pnl||0));
  const total = pnls.reduce((a,b)=>a+b, 0);

  const wins = pnls.filter(x=>x>0);
  const losses = pnls.filter(x=>x<0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const tradeCount = trades.length;

  const winRate = tradeCount ? (winCount / tradeCount) * 100 : 0;

  const grossProfit = wins.reduce((a,b)=>a+b, 0);
  const grossLossAbs = Math.abs(losses.reduce((a,b)=>a+b, 0));

  const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : (grossProfit > 0 ? 99.99 : 0);

  const expectancy = tradeCount ? total / tradeCount : 0;

  const avgWinner = winCount ? grossProfit / winCount : 0;
  const avgLoser = lossCount ? (losses.reduce((a,b)=>a+b, 0) / lossCount) : 0;

  const bestTrade = tradeCount ? Math.max(...pnls) : 0;
  const worstTrade = tradeCount ? Math.min(...pnls) : 0;

  // streaks
  let bestWinStreak = 0, bestLossStreak = 0;
  let curWin = 0, curLoss = 0;
  for (const p of pnls){
    if (p > 0){
      curWin++; curLoss = 0;
    } else if (p < 0){
      curLoss++; curWin = 0;
    } else {
      // zero resets both
      curWin = 0; curLoss = 0;
    }
    bestWinStreak = Math.max(bestWinStreak, curWin);
    bestLossStreak = Math.max(bestLossStreak, curLoss);
  }

  const riskReward = (avgWinner > 0 && avgLoser < 0) ? (avgWinner / Math.abs(avgLoser)) : 0;

  // long vs short
  const longTrades = trades.filter(t => String(t.side||"").toLowerCase() === "long");
  const shortTrades = trades.filter(t => String(t.side||"").toLowerCase() === "short");

  const lsStats = (arr) => {
    const ps = arr.map(t=>Number(t.pnl||0));
    const tot = ps.reduce((a,b)=>a+b,0);
    const w = ps.filter(x=>x>0).length;
    const c = ps.length;
    return { trades:c, pnl:tot, winRate: c ? (w/c)*100 : 0 };
  };

  // day performance (sum pnl by weekday)
  const daySum = Array(7).fill(0);
  trades.forEach(t=>{
    const dt = getTradeDate(t);
    if (!dt) return;
    const jsDay = dt.getDay(); // Sun=0..Sat=6
    // convert to Mon=0..Sun=6
    const idx = (jsDay + 6) % 7;
    daySum[idx] += Number(t.pnl||0);
  });

  return {
    total, tradeCount, winRate, winCount, lossCount,
    profitFactor, expectancy,
    avgWinner, avgLoser, bestTrade, worstTrade,
    bestWinStreak, bestLossStreak, riskReward,
    long: lsStats(longTrades),
    short: lsStats(shortTrades),
    daySum
  };
}

function buildSeries(trades){
  // equity = cumulative pnl
  const equity = [];
  let cum = 0;
  trades.forEach(t=>{
    cum += Number(t.pnl||0);
    equity.push(cum);
  });

  // drawdown from peak
  const drawdown = [];
  let peak = -Infinity;
  for (const v of equity){
    peak = Math.max(peak, v);
    drawdown.push(v - peak); // 0 or negative
  }
  return { equity, drawdown };
}

function svgPoints(values, w=1000, h=320){
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || 1;

  return values.map((v,i)=>{
    const x = (i/(values.length-1 || 1))*w;
    const y = h - ((v - min)/span)*h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function svgFill(pointsStr, w=1000, h=320){
  if (!pointsStr) return "";
  return `0,${h} ${pointsStr} ${w},${h}`;
}

function renderDayPerformance(daySum){
  const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const maxAbs = Math.max(1, ...daySum.map(v=>Math.abs(v)));

  const html = names.map((n,i)=>{
    const v = daySum[i] || 0;
    const pctW = Math.round((Math.abs(v)/maxAbs)*100);
    const color = v > 0 ? "rgba(90,255,150,.55)" : v < 0 ? "rgba(255,90,90,.55)" : "rgba(43,123,255,.25)";
    const fill = `<div class="day-fill" style="width:${pctW}%; background:${color};"></div>`;
    return `
      <div class="day-row">
        <div class="day-name muted">${n}</div>
        <div class="day-bar">${fill}</div>
        <div class="day-val ${v<0 ? "red": "blueText"}">${money(v)}</div>
      </div>
    `;
  }).join("");

  $("dayList").innerHTML = html;
}

function paintUI(trades){
  const m = calcMetrics(trades);

  $("totalPnl").textContent = money(m.total);
  $("totalPnlSub").textContent = `From ${m.tradeCount} closed trades`;

  $("winRate").textContent = pct(m.winRate);
  $("winRateSub").textContent = `${m.winCount} wins • ${m.lossCount} losses`;

  $("profitFactor").textContent = m.profitFactor.toFixed(2);
  $("expectancy").textContent = money(m.expectancy);

  $("avgWinner").textContent = money(m.avgWinner);
  $("avgLoser").textContent = money(m.avgLoser);
  $("bestTrade").textContent = money(m.bestTrade);
  $("worstTrade").textContent = money(m.worstTrade);
  $("winStreak").textContent = `${m.bestWinStreak} trades`;
  $("lossStreak").textContent = `${m.bestLossStreak} trades`;
  $("riskReward").textContent = m.riskReward.toFixed(2);

  $("longTrades").textContent = m.long.trades;
  $("longPnl").textContent = money(m.long.pnl);
  $("longWin").textContent = pct(m.long.winRate);

  $("shortTrades").textContent = m.short.trades;
  $("shortPnl").textContent = money(m.short.pnl);
  $("shortWin").textContent = pct(m.short.winRate);

  renderDayPerformance(m.daySum);

  // chart
  const { equity, drawdown } = buildSeries(trades);
  const values = chartMode === "equity" ? equity : drawdown;

  const empty = values.length < 2;
  $("chartEmpty").style.display = empty ? "grid" : "none";
  $("chart").style.opacity = empty ? "0.35" : "1";

  const pts = svgPoints(values);
  $("chartLine").setAttribute("points", pts);
  $("chartFill").setAttribute("points", svgFill(pts));

  if (chartMode === "equity"){
    $("chartNote").textContent = "Cumulative P&L progression";
  } else {
    $("chartNote").textContent = "Drawdown = decline from peak equity";
  }
}

function setActiveChip(groupEl, btn){
  groupEl.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

function wireUI(){
  $("collapseBtn").addEventListener("click", () => $("sidebar").classList.toggle("collapsed"));
  $("menuBtn").addEventListener("click", openMobileMenu);
  $("overlay").addEventListener("click", closeMobileMenu);


  $("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  // time chips
  $("timeChips").addEventListener("click", (e)=>{
    const btn = e.target.closest(".chip");
    if (!btn) return;
    rangeKey = btn.dataset.range;
    setActiveChip($("timeChips"), btn);
    paintUI(applyFilters(allTrades));
  });

  // filter chips
  $("filterChips").addEventListener("click", (e)=>{
    const btn = e.target.closest(".chip");
    if (!btn) return;
    filterKey = btn.dataset.filter;
    setActiveChip($("filterChips"), btn);
    paintUI(applyFilters(allTrades));
  });

  // chart toggle
  $("btnEquity").addEventListener("click", ()=>{
    chartMode = "equity";
    $("btnEquity").classList.add("active");
    $("btnDrawdown").classList.remove("active");
    paintUI(applyFilters(allTrades));
  });
  $("btnDrawdown").addEventListener("click", ()=>{
    chartMode = "drawdown";
    $("btnDrawdown").classList.add("active");
    $("btnEquity").classList.remove("active");
    paintUI(applyFilters(allTrades));
  });
}

function watchTrades(uid){
  const ref = collection(db, "users", uid, "trades");
  const q = query(ref, orderBy("closedAt", "asc"));

  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snap)=>{
    const arr = [];
    snap.forEach(d => arr.push({ id:d.id, ...d.data() }));
    allTrades = arr;

    const filtered = applyFilters(allTrades);
    paintUI(filtered);
  });
}

// Auth
onAuthStateChanged(auth, (user)=>{
  if (!user){
    window.location.href = "index.html";
    return;
  }
  currentUser = user;
  setUserUI(user);
  setTodayLabel();
  wireUI();
  watchTrades(user.uid);
});
