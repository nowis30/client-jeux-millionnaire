"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/api";
import dynamic from "next/dynamic";

// Tutoriel interactif chargé uniquement côté client
const OnboardingHome = dynamic(() => import("../../components/OnboardingHome"), { ssr: false });

type QuizStatus = {
  canPlay: boolean;
  hasActiveSession: boolean;
  tokens: number;
  secondsUntilNextToken?: number;
};

export default function TutorielPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("hm-session");
      if (!s) return;
      const parsed = JSON.parse(s);
      if (parsed?.gameId) setGameId(parsed.gameId);
      if (parsed?.playerId) setPlayerId(parsed.playerId);
    } catch {}
  }, []);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        setLoading(true);
        const headers: Record<string, string> = { "X-CSRF": "1" };
        if (playerId) headers["X-Player-ID"] = playerId;
        const res = await fetch(`${API_BASE}/api/games/${gameId}/quiz/status`, { credentials: "include", headers });
        if (!res.ok) return;
        const data = (await res.json()) as QuizStatus;
        setStatus(data);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId, playerId]);

  const nextTokenText = useMemo(() => {
    const s = status?.secondsUntilNextToken ?? 0;
    if (!s || s <= 0) return null;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m} min ${sec} sec`;
  }, [status?.secondsUntilNextToken]);

  return (
    <main className="max-w-none">
      {/* En-tête minimal + CTA tutoriel interactif */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="prose prose-invert max-w-none">
            <h2 className="mb-1">Tutoriel Interactif — Héritier Millionnaire</h2>
            <p className="m-0 text-neutral-300">Découvre le jeu pas à pas avec de petites bulles guidées.</p>
          </div>
          <button
            type="button"
            onClick={() => setShow(true)}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow"
          >Lancer le tutoriel</button>
        </div>
      </section>

      {/* Encart dynamique tokens quiz */}
      <section className="mb-10">
        <div className="rounded-xl border border-yellow-600/40 bg-gradient-to-r from-yellow-700/30 to-orange-700/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="text-sm text-yellow-200/90 font-medium">Vos Tokens Quiz</div>
            <div className="text-4xl font-extrabold tracking-tight text-yellow-300">{loading ? '…' : status?.tokens ?? 0}</div>
            {nextTokenText && (
              <div className="text-xs text-yellow-200/80">Prochain token dans {nextTokenText}</div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Link
              href="/quiz"
              className={`${status?.tokens && status.tokens > 0 ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-neutral-700 text-neutral-300 cursor-not-allowed'} flex-1 sm:flex-none px-4 py-2 rounded font-semibold text-sm shadow`}
              aria-disabled={!status?.tokens || status.tokens <= 0}
            >🎮 Démarrer</Link>
            <Link href="/quiz" className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm">Règles</Link>
          </div>
        </div>
      </section>

      {/* Aide & contact minimalistes */}
      <section className="mb-16">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 text-sm">
          <p className="text-neutral-300 mb-2">Tu préfères lire? Retrouve les règles essentielles sur la page Quiz.</p>
          <div className="flex gap-3">
            <Link href="/quiz" className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm">Règles du Quiz</Link>
            <Link href="/contact" className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm">Contact</Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-neutral-500">Dernière mise à jour: 8 novembre 2025</p>
      </section>

      {show && (
        <OnboardingHome onClose={() => setShow(false)} storageKey="hm-tutoriel-page" />
      )}
    </main>
  );
}
