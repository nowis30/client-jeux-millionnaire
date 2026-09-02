"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MARKET_ASSETS } from "../../lib/constants";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/format";

type MarketSymbol = (typeof MARKET_ASSETS)[number];
type Price = { symbol: string; price: number; at: string };
type Holding = { id: string; symbol: string; quantity: number; avgPrice: number };
type HistoryPoint = { at: string; price: number };
type TradeMode = "buy" | "sell";

const ASSET_META: Record<MarketSymbol, { label: string; icon: string; description: string }> = {
  SP500: { label: "S&P 500", icon: "🇺🇸", description: "Grandes entreprises américaines" },
  QQQ: { label: "Nasdaq", icon: "⚡", description: "Technologie et croissance" },
  TSX: { label: "TSX", icon: "🇨🇦", description: "Grandes entreprises canadiennes" },
  GLD: { label: "Or", icon: "◉", description: "Actif défensif" },
  TLT: { label: "Oblig.", icon: "🛡", description: "Obligations long terme" },
};

function moneyShort(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} G$`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M$`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} k$`;
  return formatMoney(value);
}

function Sparkline({ data, positive }: { data: HistoryPoint[]; positive: boolean }) {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const values = data.map((point) => Number(point.price)).filter(Number.isFinite);
    if (values.length < 2) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(0.0001, max - min);
    return values
      .map((value, index) => {
        const x = (index / Math.max(1, values.length - 1)) * 100;
        const y = 34 - ((value - min) / span) * 30;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data]);

  if (!points) {
    return <div className="grid h-20 place-items-center text-xs text-slate-500">Historique en préparation</div>;
  }

  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-24 w-full" role="img" aria-label="Évolution du prix">
      <defs>
        <linearGradient id={positive ? "sparkUp" : "sparkDown"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#67e8f9" : "#fb7185"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? "#67e8f9" : "#fb7185"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#67e8f9" : "#fb7185"}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BoursePage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [symbol, setSymbol] = useState<MarketSymbol>(MARKET_ASSETS[0]);
  const [quantity, setQuantity] = useState(1);
  const [tradeMode, setTradeMode] = useState<TradeMode>("buy");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dividends, setDividends] = useState<{ "24h": number; "7d": number; ytd: number } | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiFetch<{ games: { id: string }[] }>("/api/games");
        const game = list.games?.[0];
        if (game?.id) setGameId(game.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de rejoindre le marché");
      }
    })();
  }, []);

  useEffect(() => {
    if (!gameId || playerId) return;
    (async () => {
      try {
        const data = await apiFetch<{ player: { id: string; nickname: string; cash: number } }>(`/api/games/${gameId}/me`);
        setPlayerId(data.player.id);
        setNickname(data.player.nickname ?? "");
        setCash(Number(data.player.cash));
      } catch {
        try {
          const joined = await apiFetch<{ playerId: string }>(`/api/games/${gameId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          setPlayerId(joined.playerId);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Connexion au portefeuille impossible");
        }
      }
    })();
  }, [gameId, playerId]);

  const loadPlayer = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await apiFetch<{ player: { id: string; nickname: string; cash: number } }>(`/api/games/${gameId}/me`);
      setPlayerId((current) => current || data.player.id);
      setNickname(data.player.nickname ?? "");
      setCash(Number(data.player.cash));
    } catch {}
  }, [gameId]);

  const loadPrices = useCallback(async () => {
    if (!gameId) return;
    try {
      const data = await apiFetch<{ prices: Price[] }>(`/api/games/${gameId}/markets/latest`);
      setPrices(data.prices ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les cours");
    }
  }, [gameId]);

  const loadHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<{ holdings: Holding[] }>(`/api/games/${gameId}/markets/holdings/${playerId}`);
      setHoldings(data.holdings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le portefeuille");
    }
  }, [gameId, playerId]);

  const loadDividends = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<{ totals?: { "24h": number; "7d": number; ytd: number } }>(`/api/games/${gameId}/markets/dividends/${playerId}`);
      setDividends(data.totals ?? null);
    } catch {}
  }, [gameId, playerId]);

  useEffect(() => {
    void loadPrices();
    const timer = window.setInterval(() => void loadPrices(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadPrices]);

  useEffect(() => {
    void loadPlayer();
    void loadHoldings();
  }, [loadPlayer, loadHoldings]);

  useEffect(() => {
    if (!gameId || !symbol) return;
    let cancelled = false;
    setHistoryLoading(true);
    apiFetch<{ data: HistoryPoint[] }>(`/api/games/${gameId}/markets/history/${symbol}?years=1`)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.data) ? data.data : [];
        setHistory(list.slice(-80));
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [gameId, symbol]);

  const priceMap = useMemo(() => new Map(prices.map((price) => [price.symbol, Number(price.price)])), [prices]);
  const selectedPrice = Number(priceMap.get(symbol) ?? 0);
  const selectedHolding = holdings.find((holding) => holding.symbol === symbol);
  const selectedHoldingQty = Number(selectedHolding?.quantity ?? 0);

  const enrichedHoldings = useMemo(() => {
    return holdings.map((holding) => {
      const currentPrice = Number(priceMap.get(holding.symbol) ?? 0);
      const marketValue = currentPrice * Number(holding.quantity);
      // Important: le prix courant ET le coût moyen doivent être dans la même parenthèse.
      const unrealized = (currentPrice - Number(holding.avgPrice)) * Number(holding.quantity);
      const gainPct = Number(holding.avgPrice) > 0
        ? ((currentPrice - Number(holding.avgPrice)) / Number(holding.avgPrice)) * 100
        : 0;
      return { ...holding, currentPrice, marketValue, unrealized, gainPct };
    });
  }, [holdings, priceMap]);

  const portfolioValue = enrichedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const portfolioPnl = enrichedHoldings.reduce((sum, holding) => sum + holding.unrealized, 0);
  const totalWealth = portfolioValue + Math.max(0, Number(cash ?? 0));

  const historyChange = useMemo(() => {
    if (history.length < 2) return 0;
    const first = Number(history[0]?.price ?? 0);
    const last = Number(history[history.length - 1]?.price ?? 0);
    return first > 0 ? ((last - first) / first) * 100 : 0;
  }, [history]);

  const estimatedValue = selectedPrice * Math.max(0, Number(quantity || 0));
  const canBuy = selectedPrice > 0 && quantity > 0 && Number(cash ?? 0) >= estimatedValue;
  const canSell = selectedPrice > 0 && quantity > 0 && selectedHoldingQty >= quantity;
  const canTrade = tradeMode === "buy" ? canBuy : canSell;

  const setQuickQuantity = (ratio: number) => {
    if (selectedPrice <= 0) return;
    const available = tradeMode === "buy" ? Math.max(0, Number(cash ?? 0)) / selectedPrice : selectedHoldingQty;
    const next = Math.floor(available * ratio * 100) / 100;
    setQuantity(Math.max(0.01, next));
  };

  const handleTrade = useCallback(async () => {
    if (!gameId || !playerId || !canTrade || tradeLoading) return;
    setTradeLoading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<{ price: number }>(`/api/games/${gameId}/markets/${tradeMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, symbol, quantity }),
      });
      setMessage(`${tradeMode === "buy" ? "Achat" : "Vente"} confirmé à ${formatMoney(Number(result.price))}`);
      await Promise.all([loadPrices(), loadHoldings(), loadPlayer()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction impossible");
    } finally {
      setTradeLoading(false);
    }
  }, [gameId, playerId, canTrade, tradeLoading, tradeMode, symbol, quantity, loadPrices, loadHoldings, loadPlayer]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-3 pb-28 pt-3 sm:space-y-6 sm:px-6 sm:pb-8">
      <header className="overflow-hidden rounded-[24px] border border-cyan-300/15 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/60 p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">Marchés</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Bourse</h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">Investis, suis ton rendement et rééquilibre ton portefeuille sans tableur miniature.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Encaisse</div>
            <div className={`text-base font-black ${Number(cash ?? 0) < 0 ? "text-rose-300" : "text-emerald-300"}`}>
              {cash == null ? "—" : moneyShort(cash)}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Placements</div>
            <div className="mt-1 text-sm font-black text-white sm:text-lg">{moneyShort(portfolioValue)}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Gain latent</div>
            <div className={`mt-1 text-sm font-black sm:text-lg ${portfolioPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {portfolioPnl >= 0 ? "+" : ""}{moneyShort(portfolioPnl)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Liquidité</div>
            <div className="mt-1 text-sm font-black text-cyan-200 sm:text-lg">
              {totalWealth > 0 ? `${Math.round((Math.max(0, Number(cash ?? 0)) / totalWealth) * 100)}%` : "—"}
            </div>
          </div>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-200">✓ {message}</div>}

      <section className="ui-card p-3 sm:p-5">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3" role="tablist" aria-label="Actifs boursiers">
          {MARKET_ASSETS.map((asset) => {
            const meta = ASSET_META[asset];
            const price = Number(priceMap.get(asset) ?? 0);
            const active = symbol === asset;
            return (
              <button
                key={asset}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSymbol(asset)}
                className={[
                  "min-w-0 rounded-2xl border px-1.5 py-2.5 text-center transition active:scale-95 sm:px-3",
                  active ? "border-cyan-300/50 bg-cyan-300/12 text-white" : "border-white/8 bg-black/10 text-slate-400",
                ].join(" ")}
              >
                <span className="block text-lg sm:text-xl" aria-hidden>{meta.icon}</span>
                <span className="mt-1 block truncate text-[10px] font-extrabold sm:text-xs">{meta.label}</span>
                <span className="mt-0.5 block truncate text-[9px] text-slate-500 sm:text-[11px]">{price ? moneyShort(price) : "—"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-[22px] border border-white/10 bg-gradient-to-b from-white/[0.045] to-transparent p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>{ASSET_META[symbol].icon}</span>
                <div>
                  <h2 className="text-lg font-black text-white">{ASSET_META[symbol].label}</h2>
                  <p className="text-[11px] text-slate-500">{ASSET_META[symbol].description}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-black text-white">{selectedPrice > 0 ? formatMoney(selectedPrice) : "—"}</div>
              <div className={`text-xs font-bold ${historyChange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {historyLoading ? "…" : `${historyChange >= 0 ? "+" : ""}${historyChange.toFixed(2)}%`}
              </div>
            </div>
          </div>
          <Sparkline data={history} positive={historyChange >= 0} />
        </div>
      </section>

      <section className="ui-card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-white/10 p-2">
          <button
            type="button"
            onClick={() => setTradeMode("buy")}
            className={`min-h-11 rounded-xl text-sm font-black transition ${tradeMode === "buy" ? "bg-emerald-400 text-slate-950" : "text-slate-400"}`}
          >
            Acheter
          </button>
          <button
            type="button"
            onClick={() => setTradeMode("sell")}
            className={`min-h-11 rounded-xl text-sm font-black transition ${tradeMode === "sell" ? "bg-rose-400 text-slate-950" : "text-slate-400"}`}
          >
            Vendre
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Quantité</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(0, Number(event.target.value)))}
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-lg font-black text-white outline-none focus:border-cyan-300/60"
              />
            </label>
            <div className="pb-1 text-right">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Valeur estimée</div>
              <div className="text-sm font-black text-white">{estimatedValue > 0 ? formatMoney(estimatedValue) : "—"}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[0.25, 0.5, 0.75, 1].map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setQuickQuantity(ratio)}
                className="min-h-10 rounded-xl border border-white/10 bg-white/[0.04] text-xs font-bold text-slate-300 active:bg-white/10"
              >
                {ratio === 1 ? "MAX" : `${ratio * 100}%`}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-black/15 px-3 py-2 text-xs text-slate-400">
            <span>{tradeMode === "buy" ? "Pouvoir d'achat" : "Position disponible"}</span>
            <strong className="text-slate-200">
              {tradeMode === "buy" ? formatMoney(Math.max(0, Number(cash ?? 0))) : `${selectedHoldingQty.toFixed(2)} unités`}
            </strong>
          </div>

          <button
            type="button"
            onClick={() => void handleTrade()}
            disabled={!canTrade || tradeLoading}
            className={[
              "mt-4 min-h-14 w-full rounded-2xl text-base font-black shadow-xl transition active:scale-[0.99]",
              tradeMode === "buy" ? "bg-emerald-400 text-slate-950" : "bg-rose-400 text-slate-950",
              !canTrade || tradeLoading ? "cursor-not-allowed opacity-45" : "",
            ].join(" ")}
          >
            {tradeLoading ? "Transaction…" : tradeMode === "buy" ? `Acheter ${ASSET_META[symbol].label}` : `Vendre ${ASSET_META[symbol].label}`}
          </button>
        </div>
      </section>

      <section className="ui-card p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-white">Mon portefeuille</h2>
            <p className="text-xs text-slate-500">Touchez une position pour la négocier.</p>
          </div>
          <button type="button" onClick={() => void loadHoldings()} className="ui-btn ui-btn--neutral px-3 text-xs">↻</button>
        </div>

        {enrichedHoldings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">Aucun placement pour le moment.</div>
        ) : (
          <div className="space-y-2">
            {enrichedHoldings.map((holding) => {
              const asset = holding.symbol as MarketSymbol;
              const meta = ASSET_META[asset] ?? { label: holding.symbol, icon: "•", description: "" };
              return (
                <button
                  key={holding.id}
                  type="button"
                  onClick={() => {
                    if (MARKET_ASSETS.includes(asset)) setSymbol(asset);
                    setTradeMode("sell");
                    setQuantity(Math.max(0.01, Math.floor(Number(holding.quantity) * 100) / 100));
                  }}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-black/20 text-xl" aria-hidden>{meta.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white">{meta.label}</span>
                    <span className="block text-[11px] text-slate-500">{Number(holding.quantity).toFixed(2)} u. · coût moy. {formatMoney(Number(holding.avgPrice))}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-black text-white">{moneyShort(holding.marketValue)}</span>
                    <span className={`block text-[11px] font-bold ${holding.unrealized >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {holding.unrealized >= 0 ? "+" : ""}{holding.gainPct.toFixed(1)}%
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="ui-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-white">Dividendes</h2>
            <p className="text-[11px] text-slate-500">Revenus versés par tes placements.</p>
          </div>
          <button type="button" onClick={() => void loadDividends()} className="ui-btn ui-btn--neutral px-3 text-xs">Actualiser</button>
        </div>
        {dividends && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/15 p-2"><div className="text-[10px] text-slate-500">24 h</div><div className="text-xs font-bold text-emerald-300">{formatMoney(dividends["24h"])}</div></div>
            <div className="rounded-xl bg-black/15 p-2"><div className="text-[10px] text-slate-500">7 jours</div><div className="text-xs font-bold text-emerald-300">{formatMoney(dividends["7d"])}</div></div>
            <div className="rounded-xl bg-black/15 p-2"><div className="text-[10px] text-slate-500">Année</div><div className="text-xs font-bold text-emerald-300">{formatMoney(dividends.ytd)}</div></div>
          </div>
        )}
      </section>

      {nickname && <p className="pb-2 text-center text-[10px] text-slate-600">Portefeuille de {nickname}</p>}
    </main>
  );
}
