import { auth, db } from "./firebase.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

function money(n) {
  const num = Number(n || 0);
  const sign = num >= 0 ? "" : "-";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}
function pct(n) {
  return `${Math.round(Number(n || 0))}%`;
}

function go(page) {
  location.hash = `#${page}`;
}
function goLogin() {
  window.location.href = "index.html";
}

function setUserUI(user) {
  const name = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const letter = (name?.[0] || "U").toUpperCase();

  $("userName") && ($("userName").textContent = name);
  $("userEmail") && ($("userEmail").textContent = email);
  $("avatar") && ($("avatar").textContent = letter);
  $("topAvatar") && ($("topAvatar").textContent = letter);
}


function getTradeDate(t) {
  const cand = t.closedAt || t.date || t.tradeDate || t.createdAt || t.openTime || t.timestamp;
  if (cand && typeof cand.toDate === "function") return cand.toDate();
  if (typeof cand === "string") {
    const d = new Date(cand);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (cand instanceof Date) return cand;
  return null;
}

function toLocalYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMonthlyCalendar(dailyPnLMap, year, monthIndex) {
  const grid = $("calGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const head = document.querySelector(".cal-head");

  const now = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const first = new Date(year, monthIndex, 1);
  const startDay = (first.getDay() + 6) % 7; // Mon=0

  const totalWeeks = Math.ceil((startDay + daysInMonth) / 7);
  let dayCounter = 1;

  const isMobile = window.matchMedia("(max-width: 520px)").matches;

  if (isMobile) {
    grid.classList.add("cal-compact");
    head?.classList.add("cal-head-compact");
  } else {
    grid.classList.remove("cal-compact");
    head?.classList.remove("cal-head-compact");
  }

  for (let week = 0; week < totalWeeks; week++) {
    let weeklySum = 0;
    let weeklyTrades = 0;

    for (let i = 0; i < 7; i++) {
      const cell = document.createElement("div");
      const cellIndex = week * 7 + i;

      if (cellIndex < startDay || dayCounter > daysInMonth) {
        cell.className = "cal-cell muted-cell";
        grid.appendChild(cell);
        continue;
      }

      const d = new Date(year, monthIndex, dayCounter);
      const key = toLocalYMD(d);

      const dayPnl = Number(dailyPnLMap[key]?.pnl || 0);
      const dayTrades = Number(dailyPnLMap[key]?.trades || 0);

      weeklySum += dayPnl;
      weeklyTrades += dayTrades;

      let cls = "cal-cell";
      if (dayPnl > 0) cls += " profit";
      else if (dayPnl < 0) cls += " loss";

      cell.className = cls;
      cell.innerHTML = `
        <div class="cal-day">${dayCounter}</div>
        ${dayPnl !== 0 ? `<div class="cal-pl">${money(dayPnl)}</div>` : ``}
      `;
      grid.appendChild(cell);
      dayCounter++;
    }

    if (!isMobile) {
      const wk = document.createElement("div");
      let wkCls = "weekly-cell";
      if (weeklySum > 0) wkCls += " profit";
      else if (weeklySum < 0) wkCls += " loss";

      wk.className = wkCls;
      wk.innerHTML = `
        <div class="wk-title">WEEKLY</div>
        <div class="wk-val">${money(weeklySum)}</div>
        <div class="wk-sub">${weeklyTrades ? `${weeklyTrades} trades` : "Traded..."}</div>
      `;
      grid.appendChild(wk);
    }

    if (isMobile) {
      const row = document.createElement("div");
      let rowCls = "wk-row";
      if (weeklySum > 0) rowCls += " profit";
      else if (weeklySum < 0) rowCls += " loss";
      row.className = rowCls;

      row.innerHTML = `
        <div class="wk-left">
          <div class="wk-title2">WEEKLY TOTAL</div>
          <div class="wk-sub2">${weeklyTrades ? `${weeklyTrades} trades` : "No trades"}</div>
        </div>
        <div class="wk-val2">${money(weeklySum)}</div>
      `;
      grid.appendChild(row);
    }
  }
}

async function loadDashboard(uid) {
  const ref = collection(db, "users", uid, "trades");
  const snap = await getDocs(ref);

  let total = 0;
  let wins = 0;
  let closed = 0;
  let losses = 0;

  const dailyPnLMap = {};

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let monthlyTotal = 0;

  snap.forEach((doc) => {
    const t = doc.data() || {};
    const pnl = Number(t.pnl || 0);

    const status = String(t.status || "closed").toLowerCase();
    if (status === "open") return;

    total += pnl;
    closed++;

    if (pnl > 0) wins++;
    else if (pnl < 0) losses++;
    // else pnl === 0 => breakeven => ignore for winRate

    const dt = getTradeDate(t);
    if (!dt) return;

    if (dt.getFullYear() === y && dt.getMonth() === m) {
      const key = toLocalYMD(dt);
      if (!dailyPnLMap[key]) dailyPnLMap[key] = { pnl: 0, trades: 0 };
      dailyPnLMap[key].pnl += pnl;
      dailyPnLMap[key].trades += 1;
      monthlyTotal += pnl;
    }
  });

  const wlTotal = wins + losses;
  const winRate = wlTotal > 0 ? (wins / wlTotal) * 100 : 0;

  $("totalPnL").textContent = money(total);
  $("tradeCountLink").textContent = `→ ${snap.size} trades`;

  $("winRate").textContent = pct(winRate);
  $("winRateBar").style.width = `${Math.max(0, Math.min(100, winRate))}%`;

  $("monthLabel").textContent = `Monthly: ${money(monthlyTotal)}`;

  buildMonthlyCalendar(dailyPnLMap, y, m);
}

export async function init(user) {
  const ac = new AbortController();
  const { signal } = ac;

  const sidebar = $("sidebar");
  const overlay = $("overlay");

  setUserUI(user);

  // UI wiring (no reload, hash routing)
  // $("collapseBtn")?.addEventListener("click", () => sidebar?.classList.toggle("collapsed"), { signal });

  const openMenu = () => { sidebar?.classList.add("open"); overlay?.classList.add("show"); };
  const closeMenu = () => { sidebar?.classList.remove("open"); overlay?.classList.remove("show"); };

  $("menuBtn")?.addEventListener("click", openMenu, { signal });
  overlay?.addEventListener("click", closeMenu, { signal });

  $("goTradesBtn")?.addEventListener("click", () => go("trades"), { signal });
  $("goAnalysisBtn")?.addEventListener("click", () => go("analysis"), { signal });
  $("bnTrades")?.addEventListener("click", () => go("trades"), { signal });
  $("bnAnalysis")?.addEventListener("click", () => go("analysis"), { signal });

  $("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    goLogin();
  }, { signal });

  // load data
  await loadDashboard(user.uid);

  // rebuild calendar on resize (keeps your mobile fix correct)
  const onResize = () => loadDashboard(user.uid);
  window.addEventListener("resize", onResize, { signal });

  // cleanup on route change
  return () => {
    ac.abort();
  };
}