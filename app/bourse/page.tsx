"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_ASSETS } from "../../lib/constants";
import { apiFetch } from "../../lib/api";

type Price = { symbol: string; price: number; at: string };
type Holding = { id: string; symbol: string; quantity: number; avgPrice: number };
// Historique supprimé (on ne trace plus le graphique)

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";
// Affichage indicatif des rendements de dividendes (alignés au serveur)
const DIVIDEND_YIELDS: Record<string, number> = {
  SP500: 0.018,
  TSX: 0.03,
  VFV: 0.018,
  VDY: 0.04,
};

export default function BoursePage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string>(MARKET_ASSETS[0]);
  const [quantity, setQuantity] = useState(1);
  const [prices, setPrices] = useState<Price[]>([]);
  const [returns, setReturns] = useState<Record<string, Record<string, number>> | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [economy, setEconomy] = useState<{ baseMortgageRate: number } | null>(null);
  // plus d'historique
  const [divKpi, setDivKpi] = useState<{ "24h": number; "7d": number; ytd: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prix sélectionné et calculs d'achat
  const selectedPrice = useMemo(() => {
    const p = prices.find((x) => x.symbol === symbol);
    return p ? Number(p.price) : null;
  }, [prices, symbol]);
  const estimatedCost = useMemo(() => (selectedPrice ? Number(quantity) * selectedPrice : 0), [selectedPrice, quantity]);
  const buyingPower = useMemo(() => (typeof cash === 'number' ? Math.max(0, cash) : 0), [cash]);
  const maxBuyQty = useMemo(() => {
    if (!selectedPrice) return 0;
    const encaisse = typeof cash === 'number' ? cash : 0;
    if (encaisse <= 0) return 0;
    // Quantité au pas de 0.01
    const q = Math.max(0, Math.floor((encaisse / selectedPrice) * 100) / 100);
    return q;
  }, [cash, selectedPrice]);
  const canBuy = useMemo(() => {
    if (!selectedPrice || !quantity || quantity <= 0) return false;
    if (typeof cash !== 'number') return false;
    if (cash <= 0) return false; // pas d'achat si marge ou négatif
    return estimatedCost > 0 && estimatedCost <= cash;
  }, [cash, selectedPrice, quantity, estimatedCost]);
  const selectedHoldingQty = useMemo(() => {
    const h = holdings.find((h) => h.symbol === symbol);
    return h ? Number(h.quantity) : 0;
  }, [holdings, symbol]);
  const canSell = useMemo(() => {
    if (!quantity || quantity <= 0) return false;
    return selectedHoldingQty >= quantity;
  }, [selectedHoldingQty, quantity]);

  // Préparer les cookies cross‑site (hm_guest + hm_csrf) le plus tôt possible
  useEffect(() => {
    (async () => {
      try {
        await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
      } catch {}
    })();
  }, []);

  // Résoudre automatiquement le game id global
  useEffect(() => {
    (async () => {
      try {
        if (!gameId) {
          const list = await apiFetch<{ games: { id: string; code: string }[] }>("/api/games");
          const g = list.games?.[0];
          if (g?.id) setGameId(g.id);
        }
      } catch {}
    })();
  }, [gameId]);

  // Résoudre automatiquement le player via cookie invité si absent
  useEffect(() => {
    if (!gameId || playerId) return;
    (async () => {
      try {
        const data = await apiFetch<{ player: { id: string; nickname: string; cash: number } }>(`/api/games/${gameId}/me`);
        setPlayerId(data.player.id);
        if (data.player.nickname) setNickname(data.player.nickname);
        if (typeof data.player.cash === "number") setCash(data.player.cash);
      } catch {
        // Fallback: tenter un join explicite si /me échoue (cookies tiers bloqués)
        try {
          const j = await apiFetch<{ playerId: string }>(`/api/games/${gameId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          setPlayerId(j.playerId);
        } catch {}
      }
    })();
  }, [gameId, playerId]);

  const loadPlayer = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await apiFetch<{ player: { id: string; nickname: string; cash: number } }>(`/api/games/${gameId}/me`);
      if (data?.player) {
        if (!playerId) setPlayerId(data.player.id);
        if (data.player.nickname) setNickname(data.player.nickname);
        if (typeof data.player.cash === "number") setCash(data.player.cash);
      }
    } catch {}
  }, [gameId, playerId]);

  const loadPrices = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/latest`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { prices: Price[] } = await res.json();
      setPrices(data.prices ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les prix");
    }
  }, [gameId]);

  // plus de chargement d'historique

  const loadReturns = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/returns?windows=1d,7d,30d,ytd`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { returns: Record<string, Record<string, number>> } = await res.json();
      setReturns(data.returns ?? null);
    } catch (err) {
      // non bloquant
    }
  }, [gameId]);

  const loadHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/holdings/${playerId}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { holdings: Holding[] } = await res.json();
      setHoldings(data.holdings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les positions");
    }
  }, [gameId, playerId]);

  const loadDividendsKpi = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/dividends/${playerId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDivKpi(data?.totals ?? null);
    } catch {}
  }, [gameId, playerId]);

  useEffect(() => {
    loadPrices();
    loadReturns();
  }, [loadPrices, loadReturns]);

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  // KPI dividendes: rafraîchissement uniquement à la demande (pas d'intervalle automatique)
  // Utiliser le bouton "Actualiser dividendes" plus bas.

  // historique désactivé

  // Charger l'économie pour afficher le taux de marge (base + 5 pts)
  useEffect(() => {
    (async () => {
      if (!gameId) return;
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}/economy`);
        if (!res.ok) return;
        const data = await res.json();
        setEconomy({ baseMortgageRate: Number(data.baseMortgageRate ?? 0.05) });
      } catch {}
    })();
  }, [gameId]);

  const handleTrade = useCallback(
    async (type: "buy" | "sell") => {
      if (!gameId || !playerId) {
        setError("Connexion en cours… réessayez dans un instant");
        return;
      }
      if (type === 'buy') {
        if (typeof cash !== 'number' || cash <= 0) {
          setError("Encaisse négative (marge): achat désactivé");
          return;
        }
        if (!canBuy) {
          setError("Encaisse insuffisante pour cet achat");
          return;
        }
      }
      if (type === 'sell') {
        if (!canSell) {
          setError("Quantité insuffisante pour vendre");
          return;
        }
      }
      try {
        const data = await apiFetch<{ price: number }>(`/api/games/${gameId}/markets/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, symbol, quantity }),
        });
        setMessage(`${type === "buy" ? "Achat" : "Vente"} réalisé à ${data.price.toFixed(2)}$`);
        setError(null);
        await Promise.all([loadPrices(), loadHoldings(), loadPlayer()]);
      } catch (err) {
        setMessage(null);
        setError(err instanceof Error ? err.message : "Trade impossible");
      }
    },
    [gameId, playerId, symbol, quantity, loadHoldings, loadPrices, loadPlayer]
  );

  const enrichedHoldings = useMemo(() => {
    const priceMap = new Map(prices.map((p) => [p.symbol, p.price]));
    return holdings.map((h) => ({
      ...h,
      marketValue: (priceMap.get(h.symbol) ?? 0) * h.quantity,
      unrealized: (priceMap.get(h.symbol) ?? 0 - h.avgPrice) * h.quantity,
    }));
  }, [holdings, prices]);

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Bourse</h2>
        <p className="text-sm text-neutral-300">Investissez dans l'OR, le PÉTROLE, le S&P 500, le TSX et des OBLIGATIONS MONDIALES (pour stabiliser le portefeuille).</p>
      </section>

      {(nickname || cash != null) && (
        <section>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
            {nickname && (<p>Pseudo: <span className="font-medium">{nickname}</span></p>)}
            {cash != null && (
              <p>
                Encaisse disponible: {cash < 0 ? (
                  <span className="font-medium text-rose-400">${cash.toLocaleString()}</span>
                ) : (
                  <span className="font-medium text-emerald-400">${cash.toLocaleString()}</span>
                )}
              </p>
            )}
            {economy && (
              <p title={`Marge: base + 5 pts → ${(economy.baseMortgageRate * 100).toFixed(2)}% + 5.00 pts = ${((economy.baseMortgageRate + 0.05) * 100).toFixed(2)}%`} className="text-xs text-neutral-400">
                Marge: base + 5 pts
              </p>
            )}
          </div>
          <div className="mt-1 text-xs text-neutral-400 flex items-center gap-2">
            <button onClick={loadDividendsKpi} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">Actualiser dividendes</button>
            {divKpi ? (
              <span>Dividendes reçus: 24h ${divKpi["24h"].toFixed(2)} · 7j ${divKpi["7d"].toFixed(2)} · YTD ${divKpi.ytd.toFixed(2)}</span>
            ) : (
              <span className="text-neutral-500">Cliquer pour charger les dividendes</span>
            )}
          </div>
        </section>
      )}

  <section className="flex flex-wrap gap-3 items-end">
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          Actif
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm">
            {MARKET_ASSETS.map((asset) => (
              <option key={asset} value={asset}>
                {asset}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-neutral-300 flex flex-col gap-1">
          <label>Quantité</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            />
            <button
              type="button"
              onClick={() => setQuantity(maxBuyQty)}
              disabled={!selectedPrice || maxBuyQty <= 0}
              title={!selectedPrice ? 'Prix indisponible' : (maxBuyQty <= 0 ? 'Encaisse insuffisante' : 'Remplir au maximum achetable')}
              className={`px-2 py-1 rounded text-xs ${(!selectedPrice || maxBuyQty <= 0) ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed' : 'bg-neutral-600 hover:bg-neutral-500'}`}
            >
              Max
            </button>
          </div>
        </div>
        <div className="text-xs text-neutral-400 min-w-[220px]">
          <div>Prix: {selectedPrice != null ? `$${selectedPrice.toFixed(2)}` : '—'}</div>
          <div>Coût estimé: {estimatedCost > 0 ? `$${estimatedCost.toFixed(2)}` : '—'}</div>
          <div>Encaisse: {typeof cash === 'number' ? (cash < 0 ? <span className="text-rose-400">${cash.toLocaleString()}</span> : <span className="text-emerald-400">${cash.toLocaleString()}</span>) : '—'}</div>
          <div>Achat max: {selectedPrice ? (Math.max(0, (cash ?? 0)) / selectedPrice).toFixed(2) : '—'}</div>
        </div>
        <button
          onClick={() => handleTrade("buy")}
          disabled={!canBuy}
          title={!canBuy ? (typeof cash === 'number' && cash <= 0 ? 'Encaisse négative (marge): achat désactivé' : 'Encaisse insuffisante pour cet achat') : ''}
          className={`px-4 py-2 rounded ${canBuy ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-neutral-700 text-neutral-300 cursor-not-allowed'}`}
        >
          Acheter
        </button>
        <button
          onClick={() => handleTrade("sell")}
          disabled={!canSell}
          title={!canSell ? 'Quantité insuffisante' : ''}
          className={`px-4 py-2 rounded ${canSell ? 'bg-rose-600 hover:bg-rose-500' : 'bg-neutral-700 text-neutral-300 cursor-not-allowed'}`}
        >
          Vendre
        </button>
        <button onClick={loadPrices} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Actualiser prix</button>
        <button onClick={loadHoldings} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Actualiser positions</button>
      </section>

      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <section className="space-y-3">
  <h3 className="text-lg font-semibold">Prix simulés</h3>
        <table className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded">
          <thead>
            <tr className="text-left">
              <th className="p-2">Actif</th>
              <th className="p-2">Prix</th>
              <th className="p-2">Dernière mise à jour</th>
              <th className="p-2">DY</th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.symbol} className="border-t border-neutral-800 hover:bg-neutral-800/40 cursor-pointer" onClick={() => { setSymbol(p.symbol); }}>
                <td className="p-2">{p.symbol}</td>
                <td className="p-2">${p.price.toFixed(2)}</td>
                <td className="p-2 text-neutral-400">{new Date(p.at).toLocaleString()}</td>
                <td className="p-2 text-neutral-400">{DIVIDEND_YIELDS[p.symbol] ? ((DIVIDEND_YIELDS[p.symbol] * 100).toFixed(1) + "%") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {returns && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Rendement par actif</h3>
          <table className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded">
            <thead>
              <tr className="text-left">
                <th className="p-2">Actif</th>
                <th className="p-2">1j</th>
                <th className="p-2">7j</th>
                <th className="p-2">30j</th>
                <th className="p-2">YTD</th>
              </tr>
            </thead>
            <tbody>
              {MARKET_ASSETS.map((asset) => {
                const r = returns?.[asset] || {};
                const cells = ["1d","7d","30d","ytd"].map((k) => {
                  const v = (r as any)[k] ?? 0;
                  const pct = (v * 100).toFixed(2) + "%";
                  const cls = v >= 0 ? "text-emerald-400" : "text-rose-400";
                  return <td key={k} className={`p-2 ${cls}`}>{pct}</td>;
                });
                return (
                  <tr key={asset} className="border-t border-neutral-800">
                    <td className="p-2">{asset}</td>
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {enrichedHoldings.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Vos positions</h3>
          <table className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded">
            <thead>
              <tr className="text-left">
                <th className="p-2">Actif</th>
                <th className="p-2">Quantité</th>
                <th className="p-2">Prix moyen</th>
                <th className="p-2">Valeur marché</th>
                <th className="p-2">PNL latent</th>
              </tr>
            </thead>
            <tbody>
              {enrichedHoldings.map((h) => (
                <tr key={h.id} className="border-t border-neutral-800">
                  <td className="p-2">{h.symbol}</td>
                  <td className="p-2">{h.quantity.toFixed(2)}</td>
                  <td className="p-2">${h.avgPrice.toFixed(2)}</td>
                  <td className="p-2">${h.marketValue.toFixed(2)}</td>
                  <td className={`p-2 ${h.unrealized >= 0 ? "text-emerald-400" : "text-rose-400"}`}>${h.unrealized.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
