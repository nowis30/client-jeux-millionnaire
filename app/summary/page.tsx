"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/format";

type Entry = { playerId: string; nickname: string; netWorth: number };

export default function SummaryPage() {
  const [gameId, setGameId] = useState("");
  const [summary, setSummary] = useState<{ status: string; winner: Entry | null; leaderboard: Entry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Résoudre automatiquement la partie globale
  useEffect(() => {
    (async () => {
      try {
        if (!gameId) {
          const list = await apiFetch<{ games: { id: string }[] }>("/api/games");
          const g = list.games?.[0];
          if (g?.id) setGameId(g.id);
        }
      } catch {}
    })();
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const data = await apiFetch<{ status: string; winner: Entry | null; leaderboard: Entry[] }>(`/api/games/${gameId}/summary`);
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le résumé");
      }
    })();
  }, [gameId]);

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Résumé de la partie</h2>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {summary && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">Statut: {summary.status}</p>
          <div className="border border-neutral-800 rounded bg-neutral-900 p-3">
            <h3 className="font-semibold">Vainqueur</h3>
            {summary.winner ? (
              <p className="text-sm">{summary.winner.nickname} — {formatMoney(summary.winner.netWorth)}</p>
            ) : (
              <p className="text-sm text-neutral-400">Aucun vainqueur.</p>
            )}
          </div>
          <div className="border border-neutral-800 rounded bg-neutral-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">Joueur</th>
                  <th className="p-2">Valeur nette</th>
                </tr>
              </thead>
              <tbody>
                {summary.leaderboard.map((e: Entry, i: number) => (
                  <tr key={e.playerId} className="border-t border-neutral-800">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{e.nickname}</td>
                    <td className="p-2">{formatMoney(e.netWorth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
