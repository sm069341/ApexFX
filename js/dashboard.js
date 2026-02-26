import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const sidebar = $("sidebar");
const overlay = $("overlay");

function money(n) {
  const num = Number(n || 0);
  const sign = num >= 0 ? "" : "-";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}
function pct(n) {
  return `${Math.round(Number(n || 0))}%`;
}

function setUserUI(user) {
  const name = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const letter = (name?.[0] || "U").toUpperCase();

  $("userName").textContent = name;
  $("userEmail").textContent = email;
  $("avatar").textContent = letter;
  $("topAvatar").textContent = letter;
}

function setTodayAndClock() {
  const d = new Date();
  $("todayLabel").textContent = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const tick = () => {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 1000);
}

function wireUI() {
  $("collapseBtn").addEventListener("click", () => sidebar.classList.toggle("collapsed"));

  const openMenu = () => {
    sidebar.classList.add("open");
    overlay.classList.add("show");
  };
  const closeMenu = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };

  $("menuBtn").addEventListener("click", openMenu);
  overlay.addEventListener("click", closeMenu);

  $("goTradesBtn").addEventListener("click", () => window.location.href = "trades.html");
 $("goAnalysisBtn")?.addEventListener("click", () => window.location.href = "analysis.html");

  $("bnTrades").addEventListener("click", () => window.location.href = "trades.html");
  $("bnAnalysis")?.addEventListener("click", () => window.location.href = "analysis.html");

  $("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

/** Try to get a Date from trade doc (supports many field names) */
function getTradeDate(t) {
  // Prefer "closedAt" / "date" / "createdAt"
  const cand =
    t.closedAt || t.date || t.tradeDate || t.createdAt || t.openTime || t.timestamp;

  // Firestore Timestamp
  if (cand && typeof cand.toDate === "function") return cand.toDate();

  // ISO string or YYYY-MM-DD
  if (typeof cand === "string") {
    const d = new Date(cand);
    if (!Number.isNaN(d.getTime())) return d;
  }

  // JS Date
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
  grid.innerHTML = "";

  const now = new Date(year, monthIndex, 1);
  const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  $("monthRight").textContent = monthName;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Monday-start offset
  const first = new Date(year, monthIndex, 1);
  const startDay = (first.getDay() + 6) % 7; // Mon=0 ... Sun=6

  // Total cells in calendar body = weeks * 8 (7 days + weekly)
  const totalWeeks = Math.ceil((startDay + daysInMonth) / 7);

  let dayCounter = 1;

  for (let week = 0; week < totalWeeks; week++) {
    let weeklySum = 0;
    let weeklyTrades = 0;

    // 7 day cells
    for (let i = 0; i < 7; i++) {
      const cell = document.createElement("div");

      const cellIndex = week * 7 + i;

      // Empty before month starts or after month ends
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
        <div class="cal-pl">${money(dayPnl)}</div>
      `;

      grid.appendChild(cell);
      dayCounter++;
    }

    // Weekly cell (8th column)
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
}

async function loadDashboard(uid) {
  // Path: users/{uid}/trades/{tradeId}
  // Required for stats: pnl (number)
  // Recommended for calendar: closedAt (timestamp) or date (YYYY-MM-DD or ISO)
  // We treat status==="open" as NOT included in stats/calendar
  const ref = collection(db, "users", uid, "trades");
  const snap = await getDocs(ref);

  let total = 0;
  let wins = 0;
  let closed = 0;

  // dailyPnLMap[YYYY-MM-DD] = { pnl, trades }
  const dailyPnLMap = {};

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  let monthlyTotal = 0;

  snap.forEach((doc) => {
    const t = doc.data() || {};
    const pnl = Number(t.pnl || 0);

    // Ignore open trades from dashboard calculations
    const status = String(t.status || "closed").toLowerCase();
    if (status === "open") return;

    total += pnl;
    closed++;
    if (pnl > 0) wins++;

    const dt = getTradeDate(t);
    if (!dt) return;

    // Calendar only for current month
    if (dt.getFullYear() === y && dt.getMonth() === m) {
      const key = toLocalYMD(dt);
      if (!dailyPnLMap[key]) dailyPnLMap[key] = { pnl: 0, trades: 0 };
      dailyPnLMap[key].pnl += pnl;
      dailyPnLMap[key].trades += 1;
      monthlyTotal += pnl;
    }
  });

  const winRate = closed > 0 ? (wins / closed) * 100 : 0;

  $("totalPnL").textContent = money(total);
  $("tradeCountLink").textContent = `→ ${snap.size} trades`;

  $("winRate").textContent = pct(winRate);
  $("winRateBar").style.width = `${Math.max(0, Math.min(100, winRate))}%`;

  $("performanceLabel").textContent = money(total);
  $("chartEmpty").textContent = snap.size === 0 ? "No trades taken" : "Chart (we’ll add in Analytics later)";

  $("monthLabel").textContent = `Monthly: ${money(monthlyTotal)}`;

  buildMonthlyCalendar(dailyPnLMap, y, m);
}

// Auth guard + init
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  setUserUI(user);
  setTodayAndClock();
  wireUI();

  try {
    await loadDashboard(user.uid);
  } catch (e) {
    console.error(e);
    // still build empty calendar even if Firestore empty/blocked
    const now = new Date();
    $("monthLabel").textContent = `Monthly: ${money(0)}`;
    buildMonthlyCalendar({}, now.getFullYear(), now.getMonth());
  }
});