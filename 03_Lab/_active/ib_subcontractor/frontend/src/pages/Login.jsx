import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Login() {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      let response;
      const formData = new FormData();
      formData.append("username", email);
      formData.append("email", email);
      formData.append("password", password);

      try {
        response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          body: formData
        });
      } catch {
        response = null;
      }

      if (!response || !response.ok) {
        response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });
      }

      const payload = await response.json();

      if (!response.ok || !payload?.access_token) {
        throw new Error(payload?.detail || "Unable to sign in");
      }

      authLogin(payload.access_token);
      toast.success("Signed in");
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.message || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl shadow-slate-900/10 backdrop-blur">
        <div className="mb-8">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-signal">Prequal</div>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Access project compliance, subcontractor records, and certificate workflows.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-steel">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-orange-200"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-steel">Password</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-signal focus:ring-2 focus:ring-orange-200"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <button
            className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
