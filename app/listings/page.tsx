"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiFetch, API_BASE, ApiError } from "../../lib/api";
import { formatMoney, monthlyFromWeekly } from "../../lib/format";

type Template = {
  id?: string;
  name?: string;
  price: number;
  baseRent?: number;
  taxes?: number;
  insurance?: number;
  maintenance?: number;
  units?: number | null;
  city?: string | null;
  imageUrl?: string | null;
  plumbingState?: string | null;
  electricityState?: string | null;
  roofState?: string | null;
};

type Holding = {
  id: string;
  templateId: string;
  currentValue: number;
  currentRent: number;
  purchasePrice: number;
  mortgageDebt: number;
  weeklyPayment?: number;
  template?: Template;
};

type Listing = {
  id: string;
  gameId: string;
  holdingId?: string | null;
  templateId?: string | null;
  price: number;
  sellerId?: string | null;
  createdAt: string;
  // inclusions serveur
  holding?: Holding | null;
  template?: Template | null;
};

type Economy = {
  baseMortgageRate: number;
  appreciationAnnual: number;
  inflationAnnual?: number;
  inflationIndex?: number;
  schedule?: number[];
};

export default function ListingsPage() {
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedHoldingId, setSelectedHoldingId] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tease, setTease] = useState<string | null>(null); // Toast taquin persistant 5s
  const [economy, setEconomy] = useState<Economy | null>(null);
  useEffect(() => {
    if (!tease) return;
    const id = setTimeout(() => setTease(null), 5000);
    return () => clearTimeout(id);
  }, [tease]);

  async function revealOwnerFallback(gameId: string | null | undefined, templateId: string | null | undefined): Promise<boolean> {
    if (!gameId || !templateId) return false;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/properties/owner/${templateId}`);
      if (!res.ok) return false;
      const data = await res.json();
      const owner = data?.ownerNickname ? String(data.ownerNickname).trim() : "";
      if (owner) {
        setTease(`😜 Haha ${owner} a déjà acheté !`);
      } else {
        setTease(`😜 Haha c'est déjà acheté !`);
      }
      return true;
    } catch {
      setTease(`😜 Haha c'est déjà acheté !`);
      return true;
    }
  }

  // Résoudre automatiquement la partie globale puis mon joueur
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
    if (!gameId || playerId) return;
    (async () => {
      try {
        const me = await apiFetch<{ player: { id: string; nickname: string } }>(`/api/games/${gameId}/me`);
        setPlayerId(me.player.id);
        setNickname(me.player.nickname ?? "");
      } catch {
        // Fallback: tenter un join explicite
        try {
          const j = await apiFetch<{ playerId: string }>(`/api/games/${gameId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          setPlayerId(j.playerId);
        } catch {}
      }
    })();
  }, [gameId, playerId]);

  const refreshHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/properties/holdings/${playerId}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { holdings: Holding[] } = await res.json();
      setHoldings(data.holdings ?? []);
    } catch (err) {
      console.warn("Chargement holdings échoué", err);
    }
  }, [gameId, playerId]);

  const refreshListings = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/listings`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { listings: Listing[] } = await res.json();
      setListings(data.listings ?? []);
    } catch (err) {
      console.warn("Chargement listings échoué", err);
    }
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    refreshHoldings();
    refreshListings();
    const timer = setInterval(() => { refreshListings(); }, 30000);
    return () => clearInterval(timer);
  }, [gameId, refreshHoldings, refreshListings]);

  // Charger économie (inflation)
  useEffect(() => {
    (async () => {
      if (!gameId) return;
      try {
        const res = await fetch(`${API_BASE}/api/games/${gameId}/economy`);
        if (res.ok) {
          const data = await res.json();
          setEconomy(data);
        }
      } catch {}
    })();
  }, [gameId]);

  // Socket.IO: rafraîchir en live sur events listings
  useEffect(() => {
    if (!gameId) return;
    const socket: Socket = io(API_BASE, { query: { gameId } });
    socket.on("event-feed", (e: any) => {
      if (typeof e?.type !== "string") return;
      if (e.type.startsWith("listing:")) {
        refreshListings();
        // après accept, les holdings changent
        if (e.type === "listing:accept") refreshHoldings();
      }
    });
    socket.emit("join-game", gameId);
    return () => { socket.disconnect(); };
  }, [gameId, refreshListings, refreshHoldings]);

  const myListings = useMemo<Listing[]>(() => listings.filter((l: Listing) => l.sellerId === playerId), [listings, playerId]);
  const othersListings = useMemo<Listing[]>(() => listings.filter((l: Listing) => l.sellerId !== playerId), [listings, playerId]);

  // Déduction du type (mêmes seuils que page Immobilier)
  const kindOf = (u?: number | null) => {
    const units = Number(u || 1);
    if (units >= 800) return "VILLAGE_FUTURISTE" as const;
    if (units >= 400) return "GRATTE_CIEL" as const;
    if (units >= 50) return "TOUR" as const;
    if (units === 6) return "SIXPLEX" as const;
    if (units === 3) return "TRIPLEX" as const;
    if (units === 2) return "DUPLEX" as const;
    return "MAISON" as const;
  };

  const handleCreateListing = useCallback(async () => {
    if (!gameId || !playerId || !selectedHoldingId || price <= 0) {
      setError("Sélectionnez un bien et un prix>0");
      return;
    }
    try {
      await apiFetch(`/api/games/${gameId}/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: playerId, holdingId: selectedHoldingId, price })
      });
      setMessage("Annonce créée");
      setError(null);
      setSelectedHoldingId("");
      setPrice(0);
      refreshListings();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Échec de création d'annonce");
    }
  }, [gameId, playerId, selectedHoldingId, price, refreshListings]);

  const handleCancel = useCallback(async (id: string) => {
    if (!gameId || !playerId) return;
    try {
      await apiFetch(`/api/games/${gameId}/listings/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: playerId })
      });
      setMessage("Annonce annulée");
      setError(null);
      refreshListings();
      refreshHoldings();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Échec d'annulation");
    }
  }, [gameId, playerId, refreshListings, refreshHoldings]);

  const handleAccept = useCallback(async (id: string) => {
    if (!gameId || !playerId) return;
  const listing = listings.find((l: Listing) => l.id === id);
    const templateId = listing?.templateId || listing?.holding?.templateId || listing?.holding?.template?.id || listing?.template?.id;
    try {
      await apiFetch(`/api/games/${gameId}/listings/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: playerId })
      });
      setMessage("Achat effectué via annonce");
      setError(null);
      setTease(null);
      refreshListings();
      refreshHoldings();
    } catch (err) {
      setMessage(null);
      const status = err instanceof ApiError ? err.status : undefined;
      const msg = err instanceof Error ? err.message : "Échec d'achat";
      setError(msg);
      let handled = false;
      try {
        // Extraction pseudo vendeur si message contient patron vendu/acheté à <pseudo>
        const re = /(vendu|achete|acheté)[\s\S]*?à\s+['"]?([^'"\n]+)['"]?/i;
        const m = msg.match(re);
        if (m && m[2]) {
          const owner = m[2].trim();
          setTease(`😜 Haha ${owner} a déjà vendu !`);
          handled = true;
        } else if (/déjà/i.test(msg) && /(vendu|achete|acheté)/i.test(msg)) {
          handled = await revealOwnerFallback(gameId, templateId);
        }
      } catch { /* noop */ }
      if (!handled && status === 400 && gameId && templateId) {
        await revealOwnerFallback(gameId, templateId);
      }
    }
  }, [gameId, playerId, listings, refreshListings, refreshHoldings]);

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Annonces P2P</h2>
        <p className="text-sm text-neutral-400">Publiez vos biens ou achetez ceux des autres joueurs.</p>
        {nickname && <p className="text-xs text-neutral-400 mt-1">Connecté en tant que <span className="font-medium">{nickname}</span></p>}
        {economy && (
          <p className="text-xs text-neutral-500 mt-1">Inflation: {(Number(economy.inflationAnnual||0)*100).toFixed(2)}%/an · Indice cumulé {(Number(economy.inflationIndex||1)).toFixed(4)}×</p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Créer une annonce</h3>
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <select value={selectedHoldingId} onChange={(e) => setSelectedHoldingId(e.target.value)} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm">
            <option value="">Sélectionner un bien</option>
            {holdings.map((h) => (
              <option key={h.id} value={h.id}>
                {h.template?.name ?? h.templateId} - Valeur {formatMoney(h.currentValue)} - Dette {formatMoney(h.mortgageDebt)}
              </option>
            ))}
          </select>
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="Prix de vente" className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm" />
          <button onClick={handleCreateListing} className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">Publier</button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Mes annonces</h3>
        <div className="grid gap-2">
          {myListings.length === 0 && <p className="text-sm text-neutral-400">Aucune annonce.</p>}
          {myListings.map((l) => {
            const h = l.holding;
            const t = h?.template ?? l.template ?? null;
            const units = t?.units || 1;
            const rentMonthly = (h?.currentRent ?? t?.baseRent ?? 0) * Number(units || 1);
            const maintenanceRaw = Number(t?.maintenance ?? 0) || 0;
            const states = [t?.plumbingState, t?.electricityState, t?.roofState].map((s: any) => String(s || '').toLowerCase());
            let mult = 1.0;
            for (const s of states) {
              if (s.includes('à rénover') || s.includes('a rénover') || s.includes('rénover')) mult = Math.max(mult, 1.5);
              else if (s.includes('moyen')) mult = Math.max(mult, 1.25);
            }
            const maintenanceAdj = maintenanceRaw * mult;
            const annualExpenses = (t?.taxes ?? 0) + (t?.insurance ?? 0) + maintenanceAdj;
            const mortgageMonthly = monthlyFromWeekly(h?.weeklyPayment ?? 0);
            const expensesMonthly = annualExpenses / 12;
            const cashflowMonthly = rentMonthly - expensesMonthly - mortgageMonthly;
            const equity = (h?.currentValue ?? t?.price ?? 0) - (h?.mortgageDebt ?? 0);
            const k = kindOf(t?.units);
            return (
              <article key={l.id} className="border border-neutral-800 rounded bg-neutral-900 p-3 grid gap-2">
                <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center text-neutral-500 rounded">
                  {(() => {
                    if (k === 'GRATTE_CIEL') return <span className="text-[10px]">Pas de photo</span>;
                    const img = t?.imageUrl;
                    if (img) return <img src={String(img)} alt={t?.name || 'Immeuble'} className="w-full h-full object-cover" />;
                    return <span className="text-[10px]">Pas de photo</span>;
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div>Prix: {formatMoney(l.price)}</div>
                    <div className="text-xs text-neutral-400">Publiée: {new Date(l.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <button onClick={() => handleCancel(l.id)} className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Annuler</button>
                </div>
                {/* Bilan */}
                <div className="text-xs grid sm:grid-cols-5 gap-2 text-neutral-300">
                  <div><span className="text-neutral-400">Valeur:</span> {formatMoney(h?.currentValue ?? t?.price ?? 0)}</div>
                  <div><span className="text-neutral-400">Dette:</span> {formatMoney(h?.mortgageDebt ?? 0)}</div>
                  <div><span className="text-neutral-400">Équité:</span> <span className={equity >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(equity)}</span></div>
                  <div><span className="text-neutral-400">Loyer/mois:</span> {formatMoney(rentMonthly)}</div>
                  <div><span className="text-neutral-400">Cashflow/mois:</span> <span className={cashflowMonthly >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(cashflowMonthly)}</span></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Annonces des autres</h3>
        <div className="grid gap-2">
          {othersListings.length === 0 && <p className="text-sm text-neutral-400">Aucune annonce disponible.</p>}
          {othersListings.map((l) => {
            const h = l.holding;
            const t = h?.template ?? l.template ?? null;
            const units = t?.units || 1;
            const rentMonthly = (h?.currentRent ?? t?.baseRent ?? 0) * Number(units || 1);
            const maintenanceRaw = Number(t?.maintenance ?? 0) || 0;
            const states = [t?.plumbingState, t?.electricityState, t?.roofState].map((s: any) => String(s || '').toLowerCase());
            let mult = 1.0;
            for (const s of states) {
              if (s.includes('à rénover') || s.includes('a rénover') || s.includes('rénover')) mult = Math.max(mult, 1.5);
              else if (s.includes('moyen')) mult = Math.max(mult, 1.25);
            }
            const maintenanceAdj = maintenanceRaw * mult;
            const annualExpenses = (t?.taxes ?? 0) + (t?.insurance ?? 0) + maintenanceAdj;
            const mortgageMonthly = monthlyFromWeekly(h?.weeklyPayment ?? 0);
            const expensesMonthly = annualExpenses / 12;
            const cashflowMonthly = rentMonthly - expensesMonthly - mortgageMonthly;
            const equity = (h?.currentValue ?? t?.price ?? 0) - (h?.mortgageDebt ?? 0);
            const k = kindOf(t?.units);
            return (
              <article key={l.id} className="border border-neutral-800 rounded bg-neutral-900 p-3 grid gap-2">
                <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center text-neutral-500 rounded">
                  {(() => {
                    if (k === 'GRATTE_CIEL') return <span className="text-[10px]">Pas de photo</span>;
                    const img = t?.imageUrl;
                    if (img) return <img src={String(img)} alt={t?.name || 'Immeuble'} className="w-full h-full object-cover" />;
                    return <span className="text-[10px]">Pas de photo</span>;
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div>Prix: {formatMoney(l.price)} {t?.city ? <span className="text-xs text-neutral-400">— {t.city}</span> : null}</div>
                    <div className="text-xs text-neutral-400">Publiée: {new Date(l.createdAt).toLocaleTimeString()}</div>
                  </div>
                  <button onClick={() => handleAccept(l.id)} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm">Acheter</button>
                </div>
                {/* Bilan */}
                <div className="text-xs grid sm:grid-cols-5 gap-2 text-neutral-300">
                  <div><span className="text-neutral-400">Valeur:</span> {formatMoney(h?.currentValue ?? t?.price ?? 0)}</div>
                  <div><span className="text-neutral-400">Dette:</span> {formatMoney(h?.mortgageDebt ?? 0)}</div>
                  <div><span className="text-neutral-400">Équité:</span> <span className={equity >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(equity)}</span></div>
                  <div><span className="text-neutral-400">Loyer/mois:</span> {formatMoney(rentMonthly)}</div>
                  <div><span className="text-neutral-400">Cashflow/mois:</span> <span className={cashflowMonthly >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{formatMoney(cashflowMonthly)}</span></div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {message && <p className="text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {tease && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-900 border border-amber-500/60 text-amber-200 px-4 py-2 rounded shadow-lg animate-fade-in">
          {tease}
        </div>
      )}
    </main>
  );
}
