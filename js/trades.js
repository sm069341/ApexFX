import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let selectedPL = null; // "profit" | "loss"
let selectedSide = "short"; // default like screenshot
let unsubscribe = null;

let allTrades = [];

const filters = {
  pnl: "all", // all | profit | loss
  type: "all", // all | long | short
  time: "all", // all | today | week | month | lastMonth | 3m
};

function money(n) {
  const num = Number(n || 0);
  const sign = num >= 0 ? "" : "-";
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}

function setMsg(text, type = "") {
  const el = $("msg");
  el.className = `msg ${type}`.trim();
  el.textContent = text || "";
}

function setUserUI(user) {
  const name = user?.displayName || user?.email?.split("@")[0] || "User";
  const email = user?.email || "";
  const letter = (name?.[0] || "U").toUpperCase();

  $("userName") && ($("userName").textContent = name);
  $("userEmail") && ($("userEmail").textContent = email);

  $("avatar") && ($("avatar").textContent = letter);     // if exists anywhere
  $("topAvatar") && ($("topAvatar").textContent = letter); // if you add later
}

function setTodayLabel() {
  const d = new Date();
  $("todayLabel").textContent = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function openMobileMenu() {
  $("sidebar").classList.add("open");
  $("overlay").classList.add("show");
}
function closeMobileMenu() {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("show");
}

function openModal() {
  $("modalRoot").classList.add("show");
  $("modalRoot").setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // Reset
  selectedPL = null;
  setMsg("");
  $("tradeForm").hidden = true;
  $("stepPL").hidden = false;

  document
    .querySelectorAll(".pl-btn")
    .forEach((b) => b.classList.remove("selected"));

  // Defaults
  selectedSide = "short";
  document
    .querySelectorAll(".seg-btn")
    .forEach((b) => b.classList.remove("active"));
  document.querySelector('.seg-btn[data-side="short"]').classList.add("active");

  $("tradeForm").reset();
  $("calcPnl").textContent = "$0.00";

  // force checklist closed every time modal opens
  $("checklist").hidden = true;
  $("accIco").textContent = "›";
}
function closeModal() {
  $("modalRoot").classList.remove("show");
  $("modalRoot").setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function ymdToDateAtNoon(ymd) {
  // Avoid timezone shift: set to noon local time
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function calcPnlAndEquityBefore() {
  const amt = Math.abs(Number($("pnlAmount").value || 0));
  const eqAfter = Number($("eqAfter").value || 0);

  // pnl signed based on Profit/Loss selection
  let pnlSigned = 0;
  if (selectedPL === "profit") pnlSigned = +amt;
  if (selectedPL === "loss") pnlSigned = -amt;

  // equity before derived from equity after and pnl
  const eqBefore = eqAfter - pnlSigned;

  // UI update
  $("calcPnl").textContent = money(pnlSigned);
  $("calcEqBefore").textContent = money(eqBefore);

  // styling
  $("calcPnl").style.borderColor =
    pnlSigned > 0
      ? "rgba(90,255,200,.22)"
      : pnlSigned < 0
        ? "rgba(255,90,90,.22)"
        : "rgba(233,238,252,.10)";
  $("calcPnl").style.background =
    pnlSigned > 0
      ? "rgba(90,255,200,.08)"
      : pnlSigned < 0
        ? "rgba(255,90,90,.08)"
        : "rgba(0,0,0,.22)";

  return { pnlSigned, eqBefore, eqAfter, amt };
}

function getCloseDate(t) {
  const cand = t.closedAt || t.exitDate || t.createdAt;
  if (cand && typeof cand.toDate === "function") return cand.toDate(); // Firestore Timestamp
  if (typeof cand === "string") {
    const d = new Date(cand);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inRange(date, from, to) {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function applyFilters(trades) {
  const term = ($("searchInput")?.value || "").trim().toLowerCase();
  const now = new Date();

  let out = trades.slice();

  // Search
  if (term) {
    out = out.filter(
      (t) =>
        (t.symbol || "").toLowerCase().includes(term) ||
        (t.side || "").toLowerCase().includes(term),
    );
  }

  // PnL
  if (filters.pnl === "profit") out = out.filter((t) => Number(t.pnl || 0) > 0);
  if (filters.pnl === "loss") out = out.filter((t) => Number(t.pnl || 0) < 0);

  // Type
  if (filters.type === "long")
    out = out.filter((t) => (t.side || "").toLowerCase() === "long");
  if (filters.type === "short")
    out = out.filter((t) => (t.side || "").toLowerCase() === "short");

  // Time
  if (filters.time !== "all") {
    out = out.filter((t) => {
      const d = getCloseDate(t);
      if (!d) return false;

      if (filters.time === "today") return isSameDay(d, now);

      if (filters.time === "week") {
        const s = startOfWeek(now);
        const e = new Date(s);
        e.setDate(e.getDate() + 7);
        return d >= s && d < e;
      }

      if (filters.time === "month") {
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      }

      if (filters.time === "lastMonth") {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return (
          d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
        );
      }

      if (filters.time === "3m") {
        const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const to = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );
        return inRange(d, from, to);
      }

      return true;
    });
  }

  return out;
}

function refreshCounters() {
  const profit = allTrades.filter((t) => Number(t.pnl || 0) > 0).length;
  const loss = allTrades.filter((t) => Number(t.pnl || 0) < 0).length;
  const cp = document.getElementById("cntProfit");
  const cl = document.getElementById("cntLoss");
  if (cp) cp.textContent = `(${profit})`;
  if (cl) cl.textContent = `(${loss})`;
}

function applyAndRender() {
  const filtered = applyFilters(allTrades);
  renderRows(filtered, ""); // renderRows already supports empty table UI
}

function renderRows(trades, searchTerm = "") {
  const tbody = $("tbody");
  const term = (searchTerm || "").trim().toLowerCase();

  const filtered = term
    ? trades.filter(
        (t) =>
          (t.symbol || "").toLowerCase().includes(term) ||
          (t.side || "").toLowerCase().includes(term),
      )
    : trades;

  $("tradeCountLabel").textContent =
    `${Math.min(filtered.length, 15)} of ${filtered.length} trades`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="7">
          <div class="empty">
            <div class="empty-ico">⟂</div>
            <div class="muted">No trades match your filters</div>
            <button class="ghost-btn" id="clearFiltersBtn" type="button">Clear Filters</button>
          </div>
        </td>
      </tr>
    `;
    const btn = document.getElementById("clearFiltersBtn");
    if (btn)
      btn.addEventListener(
        "click",
        () => (($("searchInput").value = ""), renderRows(trades, "")),
      );
    return;
  }

  tbody.innerHTML = filtered
    .slice(0, 15)
    .map((t) => {
      const pnl = Number(t.pnl || 0);
      const pnlCls = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";
      const sideCls =
        (t.side || "").toLowerCase() === "long" ? "long" : "short";

      return `
        <tr>
          <td class="muted" data-label="Open / Close">${t.entryDate || "—"} / ${t.exitDate || "—"}</td>
          <td data-label="Symbol">${t.symbol || "—"}</td>
          <td data-label="Type"><span class="badge ${sideCls}">${(t.side || "—").toUpperCase()}</span></td>
          <td class="muted" data-label="Entry">${t.entryPrice ?? "—"}</td>
          <td class="muted" data-label="Exit">${t.exitPrice ?? "—"}</td>
          <td class="muted" data-label="Size">${t.qty ?? "—"}</td>
          <td class="pnl ${pnlCls}" data-label="P&L">${money(pnl)}</td>
        </tr>
      `;
    })
    .join("");
}

function watchTrades(uid) {
  const ref = collection(db, "users", uid, "trades");
  const q = query(ref, orderBy("closedAt", "desc"), limit(1000));

  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(q, (snap) => {
    const trades = [];
    snap.forEach((d) => trades.push({ id: d.id, ...d.data() }));

    allTrades = trades;
    refreshCounters();
    applyAndRender();
  });
}

function wireUI() {
  // Sidebar collapse
  $("collapseBtn").addEventListener("click", () =>
    $("sidebar").classList.toggle("collapsed"),
  );

  // Mobile menu
  $("menuBtn").addEventListener("click", openMobileMenu);
  $("overlay").addEventListener("click", closeMobileMenu);

  // Placeholders
  const notReady = (page) => alert(`${page} UI later ✅`);
  $("goAnalysisBtn").addEventListener(
    "click",
    () => (window.location.href = "analysis.html"),
  );
  $("bnAnalysis").addEventListener(
    "click",
    () => (window.location.href = "analysis.html"),
  );
  $("filtersBtn").addEventListener("click", () => {
    const panel = $("filtersPanel");
    if (!panel) return;
    panel.hidden = !panel.hidden;
  });

  // PnL chips
  $("pnlChips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".fchip");
    if (!btn) return;
    filters.pnl = btn.dataset.pnl || "all";
    document
      .querySelectorAll("#pnlChips .fchip")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyAndRender();
  });

  // Type chips
  $("typeChips")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".fchip");
    if (!btn) return;
    filters.type = btn.dataset.type || "all";
    document
      .querySelectorAll("#typeChips .fchip")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyAndRender();
  });

  // Time chips
  $("timeChipsTrades")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".fchip");
    if (!btn) return;
    filters.time = btn.dataset.time || "all";

    document
      .querySelectorAll("#timeChipsTrades .fchip")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const cr = $("customRange");
    if (cr) cr.hidden = filters.time !== "custom";

    applyAndRender();
  });

  // Clear all
  $("clearAllFiltersBtn")?.addEventListener("click", () => {
    filters.pnl = "all";
    filters.type = "all";
    filters.time = "all";

    document
      .querySelectorAll(".filters-panel .fchip")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelector('#pnlChips .fchip[data-pnl="all"]')
      ?.classList.add("active");
    document
      .querySelector('#typeChips .fchip[data-type="all"]')
      ?.classList.add("active");
    document
      .querySelector('#timeChipsTrades .fchip[data-time="all"]')
      ?.classList.add("active");

    $("searchInput").value = "";
    applyAndRender();
  });

  // Search
  $("searchInput").addEventListener("input", applyAndRender);

  // Logout
  $("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });

  $("addTradeBtn2")?.addEventListener("click", openModal);
    
  // Modal open/close
  $("addTradeBtn")?.addEventListener("click", openModal);
  $("modalClose").addEventListener("click", closeModal);
  $("modalBackdrop").addEventListener("click", closeModal);
  $("cancelBtn").addEventListener("click", closeModal);

  // Step 1 P/L selection
  document.querySelectorAll(".pl-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPL = btn.dataset.pl;
      document
        .querySelectorAll(".pl-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      $("stepPL").hidden = true;
      $("tradeForm").hidden = false;

      // If equity already typed, update
      calcPnlAndEquityBefore();
    });
  });

  // Side toggle
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSide = btn.dataset.side;
      document
        .querySelectorAll(".seg-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });


  // Live pnl calc
  ["pnlAmount", "eqAfter"].forEach((id) => {
    $(id).addEventListener("input", () => {
      if (!selectedPL) return;
      calcPnlAndEquityBefore();
    });
  });

  // Save trade
  $("tradeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!selectedPL) {
      setMsg("Select Profit or Loss first.", "err");
      return;
    }

    const symbol = $("symbol").value.trim().toUpperCase();
    const qty = Number($("qty").value || 0);
    const entryPrice = Number($("entryPrice").value || 0);
    const exitPrice = Number($("exitPrice").value || 0);
    const entryDate = $("entryDate").value;
    const exitDate = $("exitDate").value;
    const session = $("session").value;

    const amount = Number($("pnlAmount").value || 0);
    const eqAfterVal = Number($("eqAfter").value || 0);

    if (
      !symbol ||
      !qty ||
      !entryPrice ||
      !exitPrice ||
      !entryDate ||
      !exitDate
    ) {
      setMsg("Please fill all required fields.", "err");
      return;
    }

    if (!session) {
      setMsg("Please select a session.", "err");
      return;
    }

    if (!amount || amount <= 0) {
      setMsg("Enter a valid P/L amount.", "err");
      return;
    }

    if (!eqAfterVal || eqAfterVal <= 0) {
      setMsg("Enter a valid Equity After.", "err");
      return;
    }

    // ✅ Correct destructuring
    const { pnlSigned, eqBefore, eqAfter } = calcPnlAndEquityBefore();

    if (selectedPL === "profit" && pnlSigned <= 0) {
      setMsg("You selected Profit but amount is not positive.", "err");
      return;
    }

    if (selectedPL === "loss" && pnlSigned >= 0) {
      setMsg("You selected Loss but amount is not negative.", "err");
      return;
    }

    const notes = $("notes").value.trim();

    const closedAt = Timestamp.fromDate(ymdToDateAtNoon(exitDate));
    const openedAt = Timestamp.fromDate(ymdToDateAtNoon(entryDate));

    const payload = {
      status: "closed",
      result: selectedPL,
      side: selectedSide,
      symbol,
      qty,
      entryPrice,
      exitPrice,
      entryDate,
      exitDate,
      openedAt,
      closedAt,
      session,
      pnl: pnlSigned,
      equityAfter: eqAfter,
      equityBefore: eqBefore,
      notes,
      createdAt: serverTimestamp(),
    };

    const saveBtn = $("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await addDoc(collection(db, "users", currentUser.uid, "trades"), payload);
      setMsg("Trade saved ✅", "ok");
      setTimeout(closeModal, 450);
    } catch (err) {
      console.error(err);
      setMsg("Failed to save trade. Check Firestore rules.", "err");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Trade";
    }
  });
}

// Auth guard + init
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;
  setUserUI(user);
  setTodayLabel();
  wireUI();
  watchTrades(user.uid);
});


