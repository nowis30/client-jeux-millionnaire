"use client";
import { useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const resp = await apiFetch<{ id: string; email: string; isAdmin: boolean; token?: string }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (typeof window !== "undefined" && resp?.token) {
        try { window.localStorage.setItem("HM_TOKEN", resp.token); } catch {}
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'authentification");
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await apiFetch<{ ok: boolean }>("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo("Email de vérification renvoyé. Vérifiez votre boîte de réception (et spam).");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer l'email de vérification");
    }
  };

  return (
    <main className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-300">E‑mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-300">Mot de passe</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{error}</p>
            {error.toLowerCase().includes("non vérifié") && (
              <button type="button" onClick={resend} className="text-sm underline text-indigo-300">
                Renvoyer l'email de vérification
              </button>
            )}
          </div>
        )}
        {info && <p className="text-sm text-emerald-400">{info}</p>}
        <button type="submit" className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">{mode === "login" ? "Se connecter" : "S'inscrire"}</button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-sm text-neutral-300 underline">
        {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
      </button>
      {mode === "login" && (
        <p className="text-sm text-neutral-400">
          <a href="/forgot" className="underline">Mot de passe oublié ?</a>
        </p>
      )}
    </main>
  );
}
