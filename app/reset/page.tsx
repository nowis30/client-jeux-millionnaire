"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { recoveryAccessTokenFromUrl, updateSupabasePassword } from "../../lib/supabase-auth";

export default function ResetPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recoveryToken = recoveryAccessTokenFromUrl();
    setToken(recoveryToken ?? "");
    if (!recoveryToken) setError("Lien de réinitialisation invalide ou expiré.");
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Lien de réinitialisation invalide ou expiré.");
      return;
    }
    try {
      await updateSupabasePassword(token, password);
      setDone(true);
      window.setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la réinitialisation");
    }
  };

  return (
    <main className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Réinitialiser le mot de passe</h1>
      {done ? (
        <p className="text-sm text-emerald-400">Mot de passe mis à jour. Redirection…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-300">Nouveau mot de passe</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} autoComplete="new-password" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={!token} type="submit" className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60">Réinitialiser</button>
        </form>
      )}
    </main>
  );
}
