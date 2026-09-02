"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "../../lib/format";
import { apiFetch, apiFetchRaw } from "../../lib/api";

type PropertyTemplate = {
  id: string;
  name: string;
  description?: string;
  price: number;
  baseRent: number;
  units: number;
  imageUrl?: string;
  address?: string;
  city?: string;
  province?: string;
  taxes?: number;
  insurance?: number;
  maintenance?: number;
  plumbingState?: string;
  electricityState?: string;
  roofState?: string;
};

type Segment = "all" | "buyable" | "house" | "plex" | "large";
type SortMode = "yield" | "price" | "income";

const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "buyable", label: "À ma portée" },
  { id: "house", label: "Maisons" },
  { id: "plex", label: "Plex" },
  { id: "large", label: "6+ logts" },
];

const MIN_DOWN_PAYMENT = 0.20;

function metrics(property: PropertyTemplate) {
  const units = Math.max(1, Number(property.units || 1));
  const grossMonthly = Number(property.baseRent || 0) * units;
  const annualExpenses = Number(property.taxes || 0) + Number(property.insurance || 0) + Number(property.maintenance || 0);
  const noiAnnual = grossMonthly * 12 - annualExpenses;
  const capRate = Number(property.price) > 0 ? (noiAnnual / Number(property.price)) * 100 : 0;
  return {
    grossMonthly,
    annualExpenses,
    noiAnnual,
    noiMonthly: noiAnnual / 12,
    capRate,
    downPayment: Number(property.price || 0) * MIN_DOWN_PAYMENT,
  };
}

function conditionLabel(property: PropertyTemplate) {
  const states = [property.roofState, property.plumbingState, property.electricityState]
    .filter(Boolean)
    .map((state) => String(state).toLowerCase());
  if (!states.length) return { label: "État à vérifier", tone: "text-slate-300 bg-slate-700/40" };
  if (states.some((state) => state.includes("rénover"))) return { label: "Travaux à prévoir", tone: "text-amber-200 bg-amber-500/15" };
  if (states.some((state) => state.includes("moyen"))) return { label: "État moyen", tone: "text-cyan-100 bg-cyan-500/12" };
  return { label: "Bon état", tone: "text-emerald-200 bg-emerald-500/15" };
}

export default function ImmobilierPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PropertyTemplate[]>([]);
  const [playerCash, setPlayerCash] = useState<number | null>(null);
  const [segment, setSegment] = useState<Segment>("all");
  const [city, setCity] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("yield");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    try {
      const raw = localStorage.getItem("hm-session");
      if (raw) {
        const session = JSON.parse(raw);
        if (session?.gameId && session?.playerId) {
          setGameId(session.gameId);
          setPlayerId(session.playerId);
          return true;
        }
      }

      const gamesResponse = await apiFetchRaw("/api/games");
      if (!gamesResponse.ok) throw new Error("Liste des parties indisponible");
      const games = await gamesResponse.json();
      const game = games.games?.[0];
      if (!game?.id) throw new Error("Aucune partie disponible");

      const joinResponse = await apiFetchRaw(`/api/games/${game.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!joinResponse.ok) throw new Error("Connexion au marché impossible");
      const joined = await joinResponse.json();
      const session = { gameId: game.id, playerId: joined.playerId, nickname: "" };
      localStorage.setItem("hm-session", JSON.stringify(session));
      setGameId(game.id);
      setPlayerId(joined.playerId);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await ensureSession();
      if (!ok) router.push("/");
    })();
  }, [ensureSession, router]);

  useEffect(() => {
    if (!gameId) return;
    let active = true;
    setLoading(true);
    apiFetch<{ templates: PropertyTemplate[] }>(`/api/properties/templates?gameId=${encodeURIComponent(gameId)}`)
      .then((data) => {
        if (active) setTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Impossible de charger les propriétés");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !playerId) return;
    void (async () => {
      try {
        const data = await apiFetch<any>(`/api/games/${gameId}/players/${playerId}/portfolio`);
        const candidates = [data?.playerCash, data?.cash, data?.availableCash, data?.wallet?.cash, data?.player?.cash, data?.totals?.cash];
        const found = candidates.map(Number).find((value) => Number.isFinite(value));
        if (typeof found === "number") setPlayerCash(found);
      } catch {
        try {
          const state = await apiFetch<any>(`/api/games/${gameId}/state`);
          const player = (state?.players ?? []).find((item: any) => item?.id === playerId);
          if (Number.isFinite(Number(player?.cash))) setPlayerCash(Number(player.cash));
        } catch {}
      }
    })();
  }, [gameId, playerId]);

  const cities = useMemo(
    () => Array.from(new Set(templates.map((property) => property.city).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "fr")),
    [templates]
  );

  const filtered = useMemo(() => {
    const matchesSegment = (property: PropertyTemplate) => {
      const units = Math.max(1, Number(property.units || 1));
      if (segment === "buyable") return playerCash != null && metrics(property).downPayment <= playerCash;
      if (segment === "house") return units === 1;
      if (segment === "plex") return units >= 2 && units <= 5;
      if (segment === "large") return units >= 6;
      return true;
    };

    return templates
      .filter((property) => (!city || property.city === city) && matchesSegment(property))
      .slice()
      .sort((a, b) => {
        if (sortMode === "price") return Number(a.price) - Number(b.price);
        if (sortMode === "income") return metrics(b).noiMonthly - metrics(a).noiMonthly;
        return metrics(b).capRate - metrics(a).capRate;
      });
  }, [templates, city, segment, sortMode, playerCash]);

  const topOpportunity = filtered[0];

  if (loading) {
    return (
      <main className="grid min-h-[70dvh] place-items-center px-4 text-center">
        <div>
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <p className="font-semibold text-slate-300">Analyse du marché immobilier…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl pb-28 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a0d14]/94 px-3 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">Immobilier</p>
            <h1 className="truncate text-xl font-black tracking-tight text-white">Marché</h1>
          </div>
          <div className="flex items-center gap-2">
            {playerCash != null && (
              <div className="hidden rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-right min-[370px]:block">
                <div className="text-[9px] uppercase tracking-wide text-emerald-200/60">Encaisse</div>
                <div className="text-xs font-black text-emerald-200">{formatMoney(playerCash)}</div>
              </div>
            )}
            <button type="button" onClick={() => router.push("/immobilier/parc")} className="ui-btn ui-btn--info px-3 text-xs font-black">
              Mon parc
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-3 pt-4 sm:px-6 sm:pt-6">
        {error && <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        <section className="overflow-hidden rounded-[26px] border border-cyan-300/15 bg-gradient-to-br from-[#142234] via-[#0f1725] to-[#0a0d14] p-4 shadow-2xl sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="inline-flex rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
                Simulation d'investisseur
              </div>
              <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">Achète selon le rendement, pas juste selon la façade.</h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Les cartes montrent maintenant le revenu net avant financement, le taux de capitalisation et la mise de fonds de référence de 20 %.
              </p>
            </div>
            {topOpportunity && (
              <button
                type="button"
                onClick={() => router.push(`/immobilier/hypotheques?id=${topOpportunity.id}`)}
                className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-left sm:min-w-[210px]"
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-200/70">Meilleur rendement filtré</div>
                <div className="mt-1 truncate text-sm font-black text-white">{topOpportunity.name}</div>
                <div className="mt-1 text-lg font-black text-amber-200">{metrics(topOpportunity).capRate.toFixed(1)} %</div>
              </button>
            )}
          </div>
        </section>

        <section className="ui-card p-3">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SEGMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSegment(item.id)}
                className={[
                  "min-h-10 shrink-0 rounded-full border px-3 text-xs font-bold transition",
                  segment === item.id ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Ville</span>
              <select value={city} onChange={(event) => setCity(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-semibold text-slate-200">
                <option value="">Toutes les villes</option>
                {cities.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Trier par</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-semibold text-slate-200">
                <option value="yield">Meilleur rendement</option>
                <option value="price">Prix le plus bas</option>
                <option value="income">Revenu net</option>
              </select>
            </label>
          </div>
        </section>

        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-white">{filtered.length} opportunité{filtered.length > 1 ? "s" : ""}</h2>
          <span className="text-[10px] text-slate-500">Touchez un immeuble pour le financer</span>
        </div>

        {filtered.length === 0 ? (
          <section className="ui-card p-10 text-center">
            <div className="text-4xl">⌂</div>
            <h3 className="mt-2 font-black text-white">Aucun immeuble avec ces filtres</h3>
            <button type="button" onClick={() => { setSegment("all"); setCity(""); }} className="ui-btn ui-btn--neutral mt-4 text-xs">Réinitialiser</button>
          </section>
        ) : (
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((property) => {
              const stat = metrics(property);
              const condition = conditionLabel(property);
              const affordable = playerCash != null && stat.downPayment <= playerCash;
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => router.push(`/immobilier/hypotheques?id=${property.id}`)}
                  className="group min-w-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#121722] text-left shadow-lg transition active:scale-[0.985] sm:hover:-translate-y-1 sm:hover:border-cyan-300/35"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-b from-sky-950 to-slate-950">
                    <img
                      src={property.imageUrl || "/images/props/maison.svg"}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 sm:group-hover:scale-[1.035]"
                      onError={(event) => { (event.currentTarget as HTMLImageElement).src = "/images/props/maison.svg"; }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-2.5 pb-2.5 pt-8">
                      <div className="truncate text-sm font-black text-white sm:text-base">{formatMoney(Number(property.price))}</div>
                    </div>
                    <div className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                      {Math.max(1, Number(property.units || 1))} logt{Number(property.units || 1) > 1 ? "s" : ""}
                    </div>
                    {affordable && (
                      <div className="absolute right-2 top-2 rounded-full bg-emerald-400 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-950">Finançable</div>
                    )}
                  </div>

                  <div className="p-2.5 sm:p-3">
                    <h3 className="truncate text-xs font-black text-white sm:text-sm">{property.name}</h3>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{property.city || "Québec"}</p>

                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <div className="rounded-xl bg-black/20 p-2">
                        <div className="text-[8px] uppercase tracking-wide text-slate-500">Cap rate</div>
                        <div className={`mt-0.5 text-xs font-black ${stat.capRate >= 5 ? "text-emerald-300" : "text-amber-200"}`}>{stat.capRate.toFixed(1)}%</div>
                      </div>
                      <div className="rounded-xl bg-black/20 p-2">
                        <div className="text-[8px] uppercase tracking-wide text-slate-500">Net / mois</div>
                        <div className={`mt-0.5 truncate text-xs font-black ${stat.noiMonthly >= 0 ? "text-cyan-200" : "text-rose-300"}`}>{formatMoney(Math.round(stat.noiMonthly))}</div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className={`truncate rounded-full px-2 py-1 text-[8px] font-bold ${condition.tone}`}>{condition.label}</span>
                      <span className="shrink-0 text-[9px] font-bold text-slate-400">20%: {formatMoney(Math.round(stat.downPayment))}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
