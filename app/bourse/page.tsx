"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_ASSETS } from "@hm/shared";
import { loadSession } from "../../lib/session";

type Price = { symbol: string; price: number; at: string };
type Holding = { id: string; symbol: string; quantity: number; avgPrice: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export default function BoursePage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [symbol, setSymbol] = useState<string>(MARKET_ASSETS[0]);
  const [quantity, setQuantity] = useState(1);
  const [prices, setPrices] = useState<Price[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (session.gameId) setGameId((prev) => prev || session.gameId);
      if (session.playerId) setPlayerId((prev) => prev || session.playerId);
    }
  }, []);

  // Résoudre automatiquement le player via cookie invité si absent
  useEffect(() => {
    if (!gameId || playerId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}/me`);
        if (res.ok) {
          const data: { player: { id: string } } = await res.json();
          setPlayerId(data.player.id);
        }
      } catch {}
    })();
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

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  const handleTrade = useCallback(
    async (type: "buy" | "sell") => {
      if (!gameId || !playerId) {
        setError("Renseignez gameId et playerId");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}/markets/${type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId, symbol, quantity }),
        });
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
        setMessage(`${type === "buy" ? "Achat" : "Vente"} réalisé à ${data.price.toFixed(2)}$`);
        setError(null);
        await Promise.all([loadPrices(), loadHoldings()]);
      } catch (err) {
        setMessage(null);
        setError(err instanceof Error ? err.message : "Trade impossible");
      }
    },
    [gameId, playerId, symbol, quantity, loadHoldings, loadPrices]
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
        <p className="text-sm text-neutral-300">Investissez dans l'OR, le PÉTROLE, le S&P 500 et le TSX.</p>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          Game ID
          <input value={gameId} onChange={(e) => setGameId(e.target.value)} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </label>
        <label className="text-sm text-neutral-300 flex flex-col gap-1">
          Player ID
          <input value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
        </label>
      </section>

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
        <button
          onClick={() => {
            const session = loadSession();
            if (session) {
              if (session.gameId) setGameId(session.gameId);
              if (session.playerId) setPlayerId(session.playerId);
              setMessage("Session appliquée aux champs");
            }
          }}
          className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600"
        >
          Utiliser session sauvegardée
        </button>
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
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.symbol} className="border-t border-neutral-800">
                <td className="p-2">{p.symbol}</td>
                <td className="p-2">${p.price.toFixed(2)}</td>
                <td className="p-2 text-neutral-400">{new Date(p.at).toLocaleString()}</td>
              </tr>
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
