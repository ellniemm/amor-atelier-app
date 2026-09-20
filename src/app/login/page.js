"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Username atau password salah.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-6 bg-wine">
      <div className="max-w-sm mx-auto w-full">
        <p className="text-brass tracking-wide text-sm mb-2">AMOR ATELIEER</p>
        <h1 className="font-display text-4xl text-paper mb-8 leading-tight">
          Catatan keuangan atelier.
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-paper/70 text-sm mb-1">Username</label>
            <input
              className="w-full rounded-lg bg-paper/10 border border-paper/20 px-4 py-3 text-paper placeholder-paper/40 focus:outline-none focus:border-brass"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              required
            />
          </div>
          <div>
            <label className="block text-paper/70 text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg bg-paper/10 border border-paper/20 px-4 py-3 text-paper placeholder-paper/40 focus:outline-none focus:border-brass"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brass text-wineDark font-semibold py-3 mt-2 disabled:opacity-60"
          >
            {loading ? "Masuk..." : "Masuk"}
          </button>
        </form>
      </div>
    </main>
  );
}
