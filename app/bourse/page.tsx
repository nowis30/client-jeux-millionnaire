"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_ASSETS } from "../../lib/constants";
import { apiFetch, API_BASE as ABS_API_BASE } from "../../lib/api";
import { formatMoney } from "../../lib/format";

type Price = { symbol: string; price: number; at: string };
type Holding = { id: string; symbol: string; quantity: number; avgPrice: number };
// Historique supprimé (on ne trace plus le graphique)

// Utiliser l'API absolue pour export statique
const API_BASE = ABS_API_BASE;
// Affichage indicatif des rendements de dividendes (alignés au serveur)
const DIVIDEND_YIELDS: Record<string, number> = {
  SP500: 0.018,
  TSX: 0.03,
};

export default function BoursePage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [symbol, setSymbol] = useState<string>(MARKET_ASSETS[0]);
  const [quantity, setQuantity] = useState(1);
  const [prices, setPrices] = useState<Price[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [economy, setEconomy] = useState<{ baseMortgageRate: number } | null>(null);
  const [openSymbol, setOpenSymbol] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, { at: string; price: number }[]>>({});
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
    (async () => { try { await fetch(`/api/auth/csrf`, { credentials: "include" }); } catch {} })();
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
      const data = await apiFetch<{ prices: Price[] }>(`/api/games/${gameId}/markets/latest`);
      setPrices(data.prices ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les prix");
    }
  }, [gameId]);

  // plus de chargement d'historique

  

  const loadHistory = useCallback(async (sym: string, years = 10) => {
    if (!gameId) return;
    try {
      const data = await apiFetch<{ symbol: string; data: { at: string; price: number }[] }>(`/api/games/${gameId}/markets/history/${sym}?years=${years}`);
      setHistory((prev) => ({ ...prev, [sym]: data.data }));
    } catch {}
  }, [gameId]);

  const loadHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<{ holdings: Holding[] }>(`/api/games/${gameId}/markets/holdings/${playerId}`);
      setHoldings(data.holdings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les positions");
    }
  }, [gameId, playerId]);

  const loadDividendsKpi = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<any>(`/api/games/${gameId}/markets/dividends/${playerId}`);
      setDivKpi(data?.totals ?? null);
    } catch {}
  }, [gameId, playerId]);

  useEffect(() => {
    loadPrices();
    
    // Rafraîchissement automatique toutes les 15 secondes
    const interval = setInterval(() => {
      loadPrices();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [loadPrices]);

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
        const data = await apiFetch<any>(`/api/games/${gameId}/economy`);
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
      gainPct: h.avgPrice > 0 ? (((priceMap.get(h.symbol) ?? 0) - h.avgPrice) / h.avgPrice) * 100 : 0,
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
                  <span className="font-medium text-rose-400">{formatMoney(cash)}</span>
                ) : (
                  <span className="font-medium text-emerald-400">{formatMoney(cash)}</span>
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
          <div>Encaisse: {typeof cash === 'number' ? (cash < 0 ? <span className="text-rose-400">{formatMoney(cash)}</span> : <span className="text-emerald-400">{formatMoney(cash)}</span>) : '—'}</div>
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

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Graphique par actif</h3>
        <table className="w-full text-sm bg-neutral-900 border border-neutral-800 rounded">
          <thead>
            <tr className="text-left">
              <th className="p-2">Actif</th>
              <th className="p-2">Graphique</th>
            </tr>
          </thead>
          <tbody>
            {MARKET_ASSETS.map((asset) => (
              <>
                <tr key={asset} className="border-t border-neutral-800">
                  <td className="p-2">{asset}</td>
                  <td className="p-2">
                    <button
                      className="px-2 py-1 rounded bg-neutral-700 hover:bg-neutral-600 text-xs"
                      onClick={async () => {
                        const nextOpen = openSymbol === asset ? null : asset;
                        setOpenSymbol(nextOpen);
                        if (nextOpen && !history[nextOpen]) {
                          await loadHistory(nextOpen, 10);
                        }
                      }}
                    >{openSymbol === asset ? "Masquer" : "Graphique"}</button>
                  </td>
                </tr>
                {openSymbol === asset && (
                  <tr>
                    <td colSpan={2} className="p-2">
                      <HistoryChart data={(history[asset] ?? []).slice(-800)} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </section>

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
                <th className="p-2">Gain %</th>
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
                  <td className="p-2">
                    <span className={h.gainPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{h.gainPct.toFixed(2)}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const totalUnreal = enrichedHoldings.reduce((s, h) => s + (Number(h.unrealized) || 0), 0);
            const divYtd = Number(divKpi?.ytd ?? 0);
            const top = [...enrichedHoldings]
              .map(h => ({ sym: h.symbol, pnl: Number(h.unrealized)||0 }))
              .sort((a,b)=>Math.abs(b.pnl)-Math.abs(a.pnl))
              .slice(0,5);
            return (
              <div className="mt-3 border border-neutral-800 rounded bg-neutral-950 p-3">
                <h4 className="font-semibold text-sm mb-2">D’où vient l’argent (bourse)</h4>
                <div className="text-xs text-neutral-300 flex flex-wrap gap-4">
                  <div>
                    <span className="text-neutral-400">PNL latent total</span><br/>
                    <span className={totalUnreal>=0?"text-emerald-400":"text-rose-400"}>{totalUnreal>=0?"+":""}${totalUnreal.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Dividendes YTD</span><br/>
                    <span className={divYtd>=0?"text-emerald-400":"text-rose-400"}>{divYtd>=0?"+":""}${divYtd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400">Total (indicatif)</span><br/>
                    <span className={(totalUnreal+divYtd)>=0?"text-emerald-400":"text-rose-400"}>${(totalUnreal+divYtd).toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-neutral-400 mb-1">Top contributeurs (PNL latent)</div>
                  <ul className="text-xs text-neutral-300 grid md:grid-cols-3 gap-1">
                    {top.map(t => (
                      <li key={t.sym} className="flex items-center justify-between border border-neutral-800 bg-neutral-900 rounded px-2 py-1">
                        <span>{t.sym}</span>
                        <span className={t.pnl>=0?"text-emerald-400":"text-rose-400"}>{t.pnl>=0?"+":""}${t.pnl.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}
        </section>
      )}
    </main>
  );
}

function HistoryChart({ data }: { data: { at: string; price: number }[] }) {
  if (!data || data.length === 0) return <div className="text-xs text-neutral-500">Pas de données</div>;
  const w = 800, h = 220, pad = 28;
  const xs = data.map((d) => new Date(d.at).getTime());
  const ys = data.map((d) => Number(d.price));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const x = (t: number) => pad + ((t - x0) / Math.max(1, (x1 - x0))) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - y0) / Math.max(1, (y1 - y0))) * (h - pad * 2);
  const pts = data.map((d) => `${x(new Date(d.at).getTime()).toFixed(1)},${y(d.price).toFixed(1)}`).join(" ");
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56 bg-neutral-950 border border-neutral-800 rounded">
        <polyline fill="none" stroke="#60a5fa" strokeWidth={1.5} points={pts} />
        {/* Axes simples */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#333" />
      </svg>
    </div>
  );
}
