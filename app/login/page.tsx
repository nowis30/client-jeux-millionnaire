"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSupabaseSession,
  resendSupabaseSignup,
  signInWithSupabase,
  signUpWithSupabase,
} from "../../lib/supabase-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    clearSupabaseSession();

    try {
      if (mode === "login") {
        await signInWithSupabase(email, password);
        router.replace("/");
        router.refresh();
        return;
      }

      const session = await signUpWithSupabase(email, password);
      if (session.access_token) {
        router.replace("/");
        router.refresh();
      } else {
        setInfo("Compte créé. Confirme ton courriel, puis reviens te connecter.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l’authentification");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    try {
      await resendSupabaseSignup(email);
      setInfo("Courriel de confirmation renvoyé. Vérifie aussi les indésirables.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de renvoyer le courriel");
    }
  };

  return (
    <main className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">{mode === "login" ? "Connexion" : "Créer un compte"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-300">E‑mail</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-neutral-300">Mot de passe</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{error}</p>
            {(error.toLowerCase().includes("confirm") || error.toLowerCase().includes("verified")) && (
              <button type="button" onClick={resend} className="text-sm underline text-indigo-300">
                Renvoyer le courriel de confirmation
              </button>
            )}
          </div>
        )}
        {info && <p className="text-sm text-emerald-400">{info}</p>}
        <button disabled={loading} type="submit" className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60">
          {loading ? "Connexion…" : mode === "login" ? "Se connecter" : "S’inscrire"}
        </button>
      </form>
      <button
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError(null);
          setInfo(null);
        }}
        className="text-sm text-neutral-300 underline"
      >
        {mode === "login" ? "Créer un compte" : "J’ai déjà un compte"}
      </button>
      {mode === "login" && (
        <p className="text-sm text-neutral-400">
          <a href="/forgot" className="underline">Mot de passe oublié ?</a>
        </p>
      )}
    </main>
  );
}
