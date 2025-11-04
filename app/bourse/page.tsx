"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_ASSETS } from "../../lib/constants";
import { apiFetch } from "../../lib/api";

type Price = { symbol: string; price: number; at: string };
type Holding = { id: string; symbol: string; quantity: number; avgPrice: number };
type HistoryPoint = { at: string; price: number };

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
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [divKpi, setDivKpi] = useState<{ "24h": number; "7d": number; ytd: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const loadHistory = useCallback(async (sym: string, yrs = 10) => {
    if (!gameId || !sym) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/history/${encodeURIComponent(sym)}?years=${yrs}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { symbol: string; data: HistoryPoint[] } = await res.json();
      setHistory(data.data ?? []);
    } catch (err) {
      // non bloquant
    }
  }, [gameId]);

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

  useEffect(() => {
    loadDividendsKpi();
    const id = setInterval(loadDividendsKpi, 60_000);
    return () => clearInterval(id);
  }, [loadDividendsKpi]);

  // Charger l'historique lorsqu'on change d'actif
  useEffect(() => {
    if (symbol) loadHistory(symbol);
  }, [symbol, loadHistory]);

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
          {divKpi && (
            <div className="mt-1 text-xs text-neutral-400">
              Dividendes reçus: 24h ${divKpi["24h"].toFixed(2)} · 7j ${divKpi["7d"].toFixed(2)} · YTD ${divKpi.ytd.toFixed(2)}
            </div>
          )}
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
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          Quantité
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
          />
        </label>
        <button onClick={() => handleTrade("buy")} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">Acheter</button>
        <button onClick={() => handleTrade("sell")} className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500">Vendre</button>
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
              <tr key={p.symbol} className="border-t border-neutral-800 hover:bg-neutral-800/40 cursor-pointer" onClick={() => { setSymbol(p.symbol); loadHistory(p.symbol); }}>
                <td className="p-2">{p.symbol}</td>
                <td className="p-2">${p.price.toFixed(2)}</td>
                <td className="p-2 text-neutral-400">{new Date(p.at).toLocaleString()}</td>
                <td className="p-2 text-neutral-400">{DIVIDEND_YIELDS[p.symbol] ? ((DIVIDEND_YIELDS[p.symbol] * 100).toFixed(1) + "%") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {history.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold">Historique {symbol}</h3>
            <div className="text-xs text-neutral-400">
              <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => loadHistory(symbol, 1)}>1 an</button>
              <button className="ml-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => loadHistory(symbol, 5)}>5 ans</button>
              <button className="ml-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => loadHistory(symbol, 10)}>10 ans</button>
              <button className="ml-1 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700" onClick={() => loadHistory(symbol, 25)}>25 ans</button>
            </div>
          </div>
          <HistoryChart data={history} />
        </section>
      )}

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

function HistoryChart({ data }: { data: HistoryPoint[] }) {
  const w = 800, h = 200, pad = 28;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const y0 = min === max ? min * 0.95 : min * 0.98;
  const y1 = min === max ? max * 1.05 : max * 1.02;
  const points = prices.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
    const y = h - pad - ((v - y0) * (h - pad * 2)) / Math.max(1, (y1 - y0));
    return `${x},${y}`;
  }).join(" ");
  const fmt = (n: number) => (n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(2)}`);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#333" />
        <text x={pad} y={pad - 8} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y1)}</text>
        <text x={pad} y={h - pad + 12} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y0)}</text>
        <polyline fill="none" stroke="#38bdf8" strokeWidth={2} points={points} />
      </svg>
    </div>
  );
}
