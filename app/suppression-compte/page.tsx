"use client";
import Link from "next/link";
import { useState, useCallback } from "react";
import { apiFetch } from "../../lib/api";

export default function SuppressionComptePage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmAndDelete = useCallback(async () => {
    if (loading || done) return;
    setError(null);
    const ok = window.confirm("Attention: cette action supprimera définitivement votre compte et vos données principales (joueur, email). Continuer ?");
    if (!ok) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ deleted: boolean }>("/api/auth/delete-account", { method: "POST" });
      if (res?.deleted) {
        setDone(true);
        // Nettoyage localStorage de secours
        try { localStorage.removeItem("HM_TOKEN"); } catch {}
        try { localStorage.removeItem("hm-session"); } catch {}
      } else {
        setError("Suppression non confirmée côté serveur.");
      }
    } catch (e: any) {
      setError(e?.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [loading, done]);

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Suppression du compte et des données</h1>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
        <p>
          Vous pouvez demander la suppression de votre compte et de l’ensemble des données associées.
          Cette demande est possible sans être connecté.
        </p>
        <h2 className="text-xl font-semibold">Comment procéder ?</h2>
        <ol className="list-decimal list-inside space-y-1 text-neutral-200">
          <li>
            Envoyez une demande via le bouton ci-dessous ou par email à
            {" "}
            <a className="underline text-emerald-400" href="mailto:contact@nowis.store?subject=Suppression%20compte%20H%C3%A9ritier%20Millionnaire">contact@nowis.store</a>.
          </li>
          <li>
            Nous vérifierons votre identité (adresse email / identifiant joueur) pour sécuriser la suppression.
          </li>
          <li>Votre compte et vos données seront supprimés dans un délai raisonnable (généralement sous 30 jours).</li>
        </ol>

        <div className="pt-2 flex flex-col gap-2">
          <button
            disabled={loading || done}
            onClick={confirmAndDelete}
            className={`px-4 py-2 rounded font-semibold ${done ? 'bg-neutral-700 text-neutral-300 cursor-default' : loading ? 'bg-emerald-700 text-neutral-200 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-500 text-black'}`}
          >
            {done ? 'Compte supprimé' : loading ? 'Suppression...' : 'Supprimer mon compte maintenant'}
          </button>
          <a
            href="mailto:contact@nowis.store?subject=Suppression%20de%20compte%20-%20H%C3%A9ritier%20Millionnaire&body=Bonjour%2C%0AJe%20souhaite%20supprimer%20mon%20compte%20et%20toutes%20mes%20donn%C3%A9es.%0AEmail%20associ%C3%A9%20au%20compte%3A%20_____%0AIdentifiant%20joueur%20(si%20connu)%3A%20_____%0AMerci.%0A"
            className="inline-block px-4 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-center text-sm"
          >
            Ou envoyer une demande par email
          </a>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {done && <p className="text-sm text-emerald-400">Suppression effectuée. Vous pouvez fermer l’application.</p>}
        </div>

        <p className="text-sm text-neutral-400">
          Si le bouton ne fonctionne pas, écrivez-nous directement à
          {" "}
          <a className="underline" href="mailto:contact@nowis.store">contact@nowis.store</a>
          {" "}
          en précisant l’email du compte et, si possible, votre identifiant joueur.
        </p>
        <p className="text-sm text-neutral-400">
          Politique de confidentialité: {" "}
          <Link className="underline" href="/confidentialite">/confidentialite</Link>
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold mb-2">English (summary)</h2>
        <p className="text-neutral-200">
          You can request deletion of your account and associated data without being signed in. Send a request to
          {" "}
          <a className="underline text-emerald-400" href="mailto:contact@nowis.store?subject=Account%20deletion%20request">contact@nowis.store</a>.
          We will verify your identity and delete your data within a reasonable period (typically within 30 days).
        </p>
      </div>
    </main>
  );
}
