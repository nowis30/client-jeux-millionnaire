"use client";
import Link from "next/link";
import { useCallback } from "react";
import { DRAG_WEB_URL } from "../../lib/drag";

export default function SettingsPage() {
  const openExternal = useCallback(async (url: string) => {
    try {
      // Ouverture via Capacitor Browser si dispo (APK)
      const anyWin = window as any;
      if (anyWin?.Capacitor?.isNativePlatform && anyWin.Capacitor.Plugins?.Browser?.open) {
        await anyWin.Capacitor.Plugins.Browser.open({ url });
        return;
      }
      // Fallback: tenter App.openUrl (ouvre via Intent Android)
      if (anyWin?.Capacitor?.isNativePlatform && anyWin.Capacitor.Plugins?.App?.openUrl) {
        await anyWin.Capacitor.Plugins.App.openUrl({ url });
        return;
      }
    } catch {}
    // Fallback web: ouvre dans nouvel onglet navigateur
    try { window.open(url, "_blank"); } catch {}
  }, []);

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Compte</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/suppression-compte" className="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-center">Suppression de compte (in‑app)</Link>
          <button
            onClick={() => openExternal("https://app.nowis.store/delete-account.html")}
            className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-black font-semibold"
          >Ouvrir la page officielle</button>
        </div>
        <p className="text-xs text-neutral-400">Vous pouvez demander la suppression sans être connecté. Un email pré-rempli sera proposé.</p>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Confidentialité</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/confidentialite" className="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-center">Politique de confidentialité</Link>
          <button
            onClick={() => openExternal("https://app.nowis.store/privacy.html")}
            className="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700"
          >Version web</button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Mini‑jeu: Drag Shift Duel</h2>
        <p className="text-sm text-neutral-300">Joue au mini‑jeu de drag en version web. Tes gains seront crédités sur ta session Millionnaire.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => openExternal(DRAG_WEB_URL)}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
          >Jouer (ouvre le navigateur)</button>
          <button
            onClick={() => { if (typeof window !== "undefined") window.location.href = DRAG_WEB_URL; }}
            className="px-4 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 text-center"
          >Ouvrir dans cet onglet</button>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
        <h2 className="text-lg font-semibold">Assistance</h2>
        <p className="text-sm text-neutral-300">Support: <a className="underline" href="mailto:contact@nowis.store">contact@nowis.store</a></p>
      </section>
    </main>
  );
}
