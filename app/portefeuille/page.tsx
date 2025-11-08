"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/format";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export default function PortefeuillePage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [portfolio, setPortfolio] = useState<any>(null);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repayAmounts, setRepayAmounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      try {
        const list = await apiFetch<{ games: { id: string; code: string }[] }>("/api/games");
        const g = list.games?.[0];
        if (g?.id) setGameId(g.id);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const data = await apiFetch<{ player: { id: string } }>(`/api/games/${gameId}/me`);
        if (data?.player?.id) setPlayerId(data.player.id);
      } catch {}
    })();
  }, [gameId]);

  const loadPortfolio = useCallback(async () => {
    if (!gameId || !playerId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/players/${playerId}/portfolio`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setPortfolio(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur chargement portefeuille");
    } finally {
      setLoading(false);
    }
  }, [gameId, playerId]);

  const loadHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/properties/holdings/${playerId}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setHoldings(data.holdings ?? []);
    } catch (err) {
      // ignore
    }
  }, [gameId, playerId]);

  useEffect(() => {
    if (gameId && playerId) {
      loadPortfolio();
      loadHoldings();
    }
  }, [gameId, playerId, loadPortfolio, loadHoldings]);

  const handleRepay = useCallback(async (holdingId: string) => {
    const amount = Number(repayAmounts[holdingId] ?? 0);
    if (!gameId || !holdingId || amount <= 0) return alert('Montant invalide');
    try {
      // Utiliser apiFetch pour inclure automatiquement credentials, X-CSRF-Token, X-Player-ID
      const data = await apiFetch<{ applied: number; newDebt: number; playerCash?: number }>(
        `/api/games/${gameId}/properties/${holdingId}/repay`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) }
      );
      alert(`Remboursement appliqué: ${formatMoney(Math.round(data.applied ?? amount))}`);
      // rafraîchir
      await Promise.all([loadPortfolio(), loadHoldings()]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur remboursement');
    }
  }, [gameId, repayAmounts, loadPortfolio, loadHoldings]);

  const monthly = useMemo(() => {
    if (!portfolio?.totals) return null;
    return portfolio.totals;
  }, [portfolio]);

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Portefeuille</h2>
        <p className="text-sm text-neutral-300">Vue agrégée de vos immeubles, dette et gains cumulés.</p>
      </section>
      <section className="space-y-3">
        {loading && <div className="text-sm text-neutral-400">Chargement…</div>}
        {error && <div className="text-sm text-rose-400">{error}</div>}
        {monthly && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-neutral-300">
            <div>
              <div className="text-neutral-400">Valeur totale</div>
              <div className="font-medium text-neutral-200">{formatMoney(Math.round(monthly.totalValue))}</div>
            </div>
            <div>
              <div className="text-neutral-400">Dette totale</div>
              <div className="font-medium text-neutral-200">{formatMoney(Math.round(monthly.totalDebt))}</div>
            </div>
            <div>
              <div className="text-neutral-400">Cashflow (mensuel)</div>
              <div className={`font-medium ${monthly.monthlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(Math.round(monthly.monthlyNet))}</div>
            </div>
            <div>
              <div className="text-neutral-400">Biens</div>
              <div className="font-medium text-neutral-200">{monthly.holdingsCount}</div>
            </div>
          </div>
        )}

        {portfolio?.playerGains && (
          <div className="mt-3 border border-neutral-800 rounded bg-neutral-950 p-3 text-xs text-neutral-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-neutral-400">Gains cumulés (Pari)</div>
                <div className="font-medium text-neutral-200">{formatMoney(Math.round(portfolio.playerGains.cumulativePariGain))}</div>
              </div>
              <div>
                <div className="text-neutral-400">Gains cumulés (Quiz)</div>
                <div className="font-medium text-neutral-200">{formatMoney(Math.round(portfolio.playerGains.cumulativeQuizGain))}</div>
              </div>
              <div>
                <div className="text-neutral-400">Marché (réalisés)</div>
                <div className="font-medium text-neutral-200">{formatMoney(Math.round(portfolio.playerGains.cumulativeMarketRealized))}</div>
              </div>
              <div>
                <div className="text-neutral-400">Dividendes cumulés</div>
                <div className="font-medium text-neutral-200">{formatMoney(Math.round(portfolio.playerGains.cumulativeMarketDividends))}</div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <h4 className="text-sm font-semibold">Mes biens</h4>
          {holdings.length === 0 ? (
            <p className="text-sm text-neutral-400">Vous n'avez pas de biens.</p>
          ) : (
            <div className="grid gap-3">
              {holdings.map((h) => (
                <div key={h.id} className="border border-neutral-800 rounded bg-neutral-900 p-3 text-xs text-neutral-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{h.template?.name ?? 'Bien'}</div>
                      <div className="text-neutral-400 text-[12px]">Valeur: {formatMoney(Math.round(h.currentValue ?? 0))} · Dette: {formatMoney(Math.round(h.mortgageDebt ?? 0))}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-neutral-400 text-[12px]">Loyer hebdo: {formatMoney(Math.round(h.currentRent ?? 0))}</div>
                      <div className="text-neutral-400 text-[12px]">Paiement hebdo: {formatMoney(Math.round(h.weeklyPayment ?? 0))}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-xs" placeholder="Montant à rembourser" value={repayAmounts[h.id] ?? ''} onChange={(e) => setRepayAmounts((m) => ({ ...m, [h.id]: Number(e.target.value) }))} />
                    <button onClick={() => handleRepay(h.id)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">Rembourser</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
