import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const $ = (id) => document.getElementById(id);

const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password");
const msgEl = $("msg");
const btn = $("loginBtn");
const togglePass = $("togglePass");
const forgotBtn = $("forgotBtn");

$("year").textContent = new Date().getFullYear();

function setMsg(text, type = "") {
  msgEl.className = `msg ${type}`.trim();
  msgEl.textContent = text || "";
}

function goApp(hash = "dashboard") {
  // login page is NOT inside iframe normally, so just go to shell
  window.location.href = `app.html#${hash}`;
}

togglePass.addEventListener("click", () => {
  const isPass = passEl.type === "password";
  passEl.type = isPass ? "text" : "password";
  togglePass.textContent = isPass ? "🙈" : "👁";
});

onAuthStateChanged(auth, (user) => {
  // If already logged in, go to app shell dashboard
  if (user) goApp("dashboard");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");

  const email = emailEl.value.trim();
  const password = passEl.value;

  btn.disabled = true;
  btn.textContent = "Logging in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMsg("Login success. Redirecting...", "ok");
    goApp("dashboard");
  } catch (err) {
    setMsg(prettyAuthError(err), "err");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="dot"></span> Login`;
  }
});

forgotBtn.addEventListener("click", async () => {
  const email = emailEl.value.trim();
  if (!email) return setMsg("Enter your email first to reset password.", "err");

  try {
    await sendPasswordResetEmail(auth, email);
    setMsg("Password reset email sent. Check your inbox.", "ok");
  } catch (err) {
    setMsg(prettyAuthError(err), "err");
  }
});

function prettyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("auth/invalid-email")) return "Invalid email address.";
  if (code.includes("auth/missing-password")) return "Please enter your password.";
  if (code.includes("auth/invalid-credential")) return "Wrong email or password.";
  if (code.includes("auth/user-disabled")) return "This account is disabled.";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  return err?.message || "Login failed.";
}