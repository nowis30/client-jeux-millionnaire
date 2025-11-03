"use client";
import { useState } from "react";
import { apiFetch } from "../../lib/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi");
    }
  };

  return (
    <main className="max-w-sm mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Mot de passe oublié</h1>
      {sent ? (
        <p className="text-sm text-emerald-400">Si un compte existe pour cet e‑mail, un lien de réinitialisation a été envoyé.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-neutral-300">E‑mail</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" className="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Envoyer le lien</button>
        </form>
      )}
    </main>
  );
}
