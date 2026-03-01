import { auth } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.currentUser) navigate("/", { replace: true });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="TradeXVault"
            className="h-12 w-auto drop-shadow-md"
          />
          <div>
            <div className="text-xl font-semibold">TradeXVault</div>
            <div className="text-sm text-zinc-400">
              Sign in to your dashboard
            </div>
          </div>
        </div>

        <div className="mt-6">
          {
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700/40"
                  required
                />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                <label className="mb-2 block text-xs font-medium text-zinc-400">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-600 focus:ring-2 focus:ring-zinc-700/40"
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-white transition"
              >
                Sign In
              </button>

              <div className="pt-2 text-center text-xs text-zinc-500">
                Secure login • TradeXVault
              </div>
            </form>
          }
        </div>
      </div>
    </div>
  );
}
