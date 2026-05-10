import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // success overlay state
  const [success, setSuccess] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string>("");

  const navigate = useNavigate();

  useEffect(() => {
    if (auth.currentUser) navigate("/", { replace: true });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);

      const display =
        (cred.user.email || "Trader").split("@")[0]?.trim() || "Trader";

      setWelcomeName(display);
      setSuccess(true);

      // small delay so user sees the success animation
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 900);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setSuccess(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black flex items-center justify-center px-4">
      <div
        className={[
          "relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl",
          "animate-[fadeUp_.45s_ease-out]",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-[2px] hover:shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
        ].join(" ")}
      >
        {/* ✅ Success overlay */}
        {success && (
          <div className="absolute inset-0 z-10 rounded-2xl border border-emerald-500/20 bg-zinc-950/70 backdrop-blur-sm">
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
                Welcome, {welcomeName} 👋
              </div>
              <div className="mt-1 text-sm text-zinc-400 animate-[fadeUp_.25s_ease-out]">
                Redirecting to your dashboard…
              </div>

              {/* tiny progress bar */}
              <div className="mt-5 h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-full origin-left animate-[progress_.9s_ease-out_forwards] rounded-full bg-emerald-500/70" />
              </div>
            </div>
          </div>
        )}

        {/* Brand */}
<div className="flex items-center gap-3 px-2 py-2">
  {/* Bigger Logo */}
  <div className="grid h-16 w-16 place-items-center rounded-xl bg-white shadow-sm dark:bg-zinc-950">
    <img
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="ApexFX"
      className="h-16 w-16 object-contain drop-shadow-md"
    />
  </div>

  {/* ApexFX Branding */}
  <div className="flex flex-col justify-center">
  <h1 className="h-10 pt-1 text-[30px] font-black italic -skew-x-6 tracking-tight leading-none overflow-visible">
    <span className="text-slate-900 dark:text-white">
      Apex
    </span>

    <span className="bg-gradient-to-b from-blue-300 via-blue-500 to-blue-900 bg-clip-text text-transparent drop-shadow-[0_2px_5px_rgba(20,60,160,0.28)]">
      FX
    </span>
  </h1>

  <span className="-mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
    Trading Journal
  </span>
</div>
</div>

        <div className="mt-6">
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-950/70">
              <label className="mb-2 block text-xs font-medium text-zinc-400">
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || success}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700/40 disabled:opacity-60"
                required
              />
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-950/70">
              <label className="mb-2 block text-xs font-medium text-zinc-400">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || success}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700/40 disabled:opacity-60"
                required
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-400 animate-[fadeUp_.25s_ease-out]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || success}
              className={[
                "w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ease-out",
                loading || success
                  ? "bg-zinc-700 text-zinc-300 cursor-not-allowed"
                  : "bg-white/90 text-zinc-950 hover:bg-white hover:-translate-y-[1px] hover:shadow-lg active:scale-[0.98]",
              ].join(" ")}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            <div className="pt-2 text-center text-xs text-zinc-500">
              Secure login • ApexFX
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
