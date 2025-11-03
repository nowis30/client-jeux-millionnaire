"use client";
import { useEffect, useState } from "react";
import { loadSession } from "../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

type Entry = { playerId: string; nickname: string; netWorth: number };

export default function SummaryPage() {
  const [gameId, setGameId] = useState("");
  const [summary, setSummary] = useState<{ status: string; winner: Entry | null; leaderboard: Entry[]; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (s?.gameId) setGameId(s.gameId);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}/summary`);
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
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
          <p className="text-sm text-neutral-300">Code: <span className="font-mono">{summary.code}</span> • Statut: {summary.status}</p>
          <div className="border border-neutral-800 rounded bg-neutral-900 p-3">
            <h3 className="font-semibold">Vainqueur</h3>
            {summary.winner ? (
              <p className="text-sm">{summary.winner.nickname} — ${summary.winner.netWorth.toLocaleString()}</p>
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
                    <td className="p-2">${e.netWorth.toLocaleString()}</td>
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
