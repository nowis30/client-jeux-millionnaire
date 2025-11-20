"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "../../lib/format";
import { API_BASE, apiFetch } from "../../lib/api";

interface PropertyTemplate {
  id: string;
  name: string;
  description: string;
  price: number;
  baseRent: number;
  units: number;
  imageUrl: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  yearBuilt: number;
  surfaceArea: number;
  landArea: number;
  taxes: number;
  insurance: number;
  maintenance: number;
  plumbingState: string;
  electricityState: string;
  roofState: string;
  windowsState: string;
  foundationState: string;
  interiorState: string;
  exteriorState: string;
}

// Catégories strictement typées
const CATEGORIES = [
  { id: 'all', label: 'Tous' },
  { id: 'buyable', label: 'Achetables' },
  { id: 'u12', label: '1–2 logts' },
  { id: 'u34', label: '3–4 logts' },
  { id: 'u56', label: '5–6 logts' },
  { id: 'u50p', label: '50+ logts' },
  { id: 'p2', label: '250k–500k' },
  { id: 'p3', label: '500k–1M' },
  { id: 'p4', label: '1M+' },
] as const;

type Category = typeof CATEGORIES[number]['id'];

export default function ImmobilierPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PropertyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerCash, setPlayerCash] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [selectedCity, setSelectedCity] = useState<string>('');

  // Compte des résultats par catégorie (après filtre ville et avec cash)
  const categoryCounts: Record<Category, number> = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    const byCity = selectedCity ? list.filter(p => p.city === selectedCity) : list;

    const apply = (cat: Category, prop: PropertyTemplate) => {
      switch (cat) {
        case 'buyable':
          return playerCash !== null && Number(prop.price) <= playerCash;
        case 'u12':
          return Number(prop.units || 0) <= 2;
        case 'u34':
          return Number(prop.units || 0) >= 3 && Number(prop.units || 0) <= 4;
        case 'u56':
          return Number(prop.units || 0) >= 5 && Number(prop.units || 0) <= 6;
        case 'u50p':
          return Number(prop.units || 0) >= 50;
        case 'p2':
          return Number(prop.price || 0) >= 250000 && Number(prop.price || 0) < 500000;
        case 'p3':
          return Number(prop.price || 0) >= 500000 && Number(prop.price || 0) < 1000000;
        case 'p4':
          return Number(prop.price || 0) >= 1000000;
        default:
          return true;
      }
    };

    const map = Object.fromEntries(
      CATEGORIES.map(({ id }) => [id, byCity.filter(p => apply(id, p)).length])
    ) as Record<Category, number>;
    return map;
  }, [templates, selectedCity, playerCash]);

  const filteredTemplates = useMemo(() => {
    const list = Array.isArray(templates) ? templates : [];
    return list.filter((prop) => {
      if (selectedCity && prop.city !== selectedCity) return false;
      switch (selectedCategory) {
        case 'buyable':
          return playerCash !== null && Number(prop.price) <= playerCash;
        case 'u12':
          return Number(prop.units) <= 2;
        case 'u34':
          return Number(prop.units) >= 3 && Number(prop.units) <= 4;
        case 'u56':
          return Number(prop.units) >= 5 && Number(prop.units) <= 6;
        case 'u50p':
          return Number(prop.units) >= 50;
        case 'p2':
          return Number(prop.price) >= 250000 && Number(prop.price) < 500000;
        case 'p3':
          return Number(prop.price) >= 500000 && Number(prop.price) < 1000000;
        case 'p4':
          return Number(prop.price) >= 1000000;
        default:
          return true;
      }
    });
  }, [templates, selectedCity, selectedCategory, playerCash]);

  const ensureSession = useCallback(async () => {
    try {
      const raw = localStorage.getItem("hm-session");
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.gameId && s?.playerId) {
          setGameId(s.gameId);
          setPlayerId(s.playerId);
          return true;
        }
      }
      // Auto-join si aucune session
      const resList = await fetch(`${API_BASE}/api/games`, { credentials: 'include' });
      if (!resList.ok) throw new Error('Liste parties indisponible');
      const dataList = await resList.json();
      const g = dataList.games?.[0];
      if (!g) throw new Error('Aucune partie disponible');
      const resJoin = await fetch(`${API_BASE}/api/games/${g.id}/join`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      });
      if (!resJoin.ok) throw new Error('Join échoué');
      const dataJoin = await resJoin.json();
      const sess = { gameId: g.id, playerId: dataJoin.playerId, nickname: '' };
      try { localStorage.setItem('hm-session', JSON.stringify(sess)); } catch {}
      setGameId(g.id);
      setPlayerId(dataJoin.playerId);
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await ensureSession();
      if (!ok) {
        router.push("/");
      }
    })();
  }, [ensureSession, router]);

  useEffect(() => {
    if (!gameId) return;

    async function loadTemplates() {
      try {
        setLoading(true);
        // On passe gameId pour exclure les propriétés déjà achetées
        const data = await apiFetch<{ templates: PropertyTemplate[] }>(
          `/api/properties/templates?gameId=${gameId}`
        );
        setTemplates(data.templates);
      } catch (err: any) {
        console.error("Erreur chargement immeubles:", err);
        setError(err.message || "Impossible de charger les propriétés");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, [gameId]);

  // Helpers robustes pour extraire le cash depuis différentes structures possibles
  function extractCash(data: any): number | null {
    if (!data) return null;
    const candidates = [
      data.playerCash,
      data.cash,
      data.availableCash,
      data.liquidCash,
      data.wallet?.cash,
      data.player?.cash,
      data.totals?.cash,
      data.totals?.availableCash
    ];
    for (const v of candidates) {
      const n = Number(v);
      if (!Number.isNaN(n) && Number.isFinite(n)) return Math.round(n);
    }
    return null;
  }

  // Charger le cash disponible du joueur depuis le portefeuille
  useEffect(() => {
    if (!gameId || !playerId) return;
    (async () => {
      try {
        const data = await apiFetch<any>(`/api/games/${gameId}/players/${playerId}/portfolio`);
        const cash = extractCash(data);
        if (cash !== null) {
          setPlayerCash(cash);
        } else {
          // tentative de fallback via l'état global (si dispo)
          try {
            const st = await apiFetch<any>(`/api/games/${gameId}/state`);
            const p = (st?.players || []).find((pp: any) => pp?.id === playerId);
            const cc = extractCash(p);
            if (cc !== null) setPlayerCash(cc);
          } catch {}
        }
      } catch (e) {
        // silencieux: ne bloque pas la page si indisponible
      }
    })();
  }, [gameId, playerId]);

  const handlePropertyClick = (id: string) => {
    router.push(`/immobilier/hypotheques?id=${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 text-surface-on flex items-center justify-center">
        <div className="text-xl">Chargement des opportunités...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 text-surface-on pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-1/95 backdrop-blur border-b border-surface-divider p-4 shadow-elev-1">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={() => router.push("/")}
            className="ui-btn ui-btn--neutral text-sm"
          >
            ← Retour
          </button>
          <h1 className="flex-1 text-xl font-bold text-center bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Agence Immobilière
          </h1>
          <div className="flex items-center gap-2">
            {playerCash !== null && (
              <div className="px-2 py-1 rounded border border-emerald-700 bg-emerald-900/30 text-emerald-200 text-xs font-semibold whitespace-nowrap">
                {formatMoney(playerCash)} dispo
              </div>
            )}
            <button
              onClick={() => router.push("/immobilier/parc")}
              className="ui-btn ui-btn--info text-sm font-bold"
            >
              Mon Parc
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4">
        {error && (
          <div className="mb-6 p-4 border border-rose-700/60 bg-rose-900/30 rounded-card text-rose-100">
            {error}
          </div>
        )}

        <div className="mb-6 text-center">
          <p className="text-slate-400">
            Investissez dans l'immobilier pour générer des revenus passifs.
            <br />
            <span className="text-xs opacity-70">Les prix incluent le terrain et le bâtiment.</span>
          </p>
        </div>

        {/* Filtres */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs border',
                  selectedCategory === c.id
                    ? 'bg-brand-sky/20 border-brand-sky text-brand-sky'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60'
                ].join(' ')}
              >
                {c.label} ({categoryCounts[c.id] ?? 0})
              </button>
            ))}
          </div>
          {/* Ville */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Ville:</span>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700"
            >
              <option value="">Toutes</option>
              {[...new Set(templates.map(t => t.city).filter(Boolean))]
                .sort((a,b)=>String(a).localeCompare(String(b)))
                .map((c) => (
                  <option key={String(c)} value={String(c)}>{String(c)}</option>
                ))}
            </select>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-12 ui-card">
            <div className="text-4xl mb-4">🏙️</div>
            <h3 className="text-xl font-bold mb-2">Aucune propriété disponible</h3>
            <p className="text-surface-muted">
              Le marché est actuellement vide ou vous avez tout acheté !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full text-center py-10 ui-card">
                <div className="text-4xl mb-2">🔎</div>
                <div className="font-semibold mb-1">Aucun résultat pour ce filtre</div>
                <div className="text-sm text-neutral-400">Modifiez la catégorie ou la ville pour voir des biens.</div>
              </div>
            ) : (
              filteredTemplates.map((prop) => (
              <div
                key={prop.id}
                onClick={() => handlePropertyClick(prop.id)}
                className="group ui-card overflow-hidden hover:border-brand-sky/60 transition-all cursor-pointer hover:shadow-elev-2 hover:-translate-y-1"
              >
                <div className="relative h-48 bg-surface-3 overflow-hidden">
                  {prop.imageUrl ? (
                    <img
                      src={prop.imageUrl}
                      alt={prop.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://placehold.co/600x400/1e293b/cbd5e1?text=Immeuble";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-surface-muted">
                      <span className="text-4xl">🏢</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-xs font-bold text-white border border-white/10">
                    {prop.units} logement{prop.units > 1 ? "s" : ""}
                  </div>
                  {playerCash !== null && (
                    <div className="absolute top-2 left-2">
                      {prop.price <= playerCash ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-semibold border border-emerald-400/50">Achetable</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-neutral-900/80 text-neutral-200 text-[11px] border border-neutral-700/60">
                          Manque {formatMoney(prop.price - playerCash)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-12">
                    <div className="text-white font-bold text-lg truncate shadow-black drop-shadow-md">
                      {formatMoney(prop.price)}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1 text-surface-on group-hover:text-brand-sky transition-colors truncate">
                    {prop.name}
                  </h3>
                  <div className="flex items-center text-xs text-surface-muted mb-3">
                    <span className="truncate">
                      📍 {prop.address}, {prop.city}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div className="bg-surface-1 p-2 rounded border border-surface-divider">
                      <div className="text-surface-muted text-xs">Revenus bruts</div>
                      <div className="font-semibold text-emerald-400">
                        {formatMoney(prop.baseRent * prop.units)}/mois
                      </div>
                    </div>
                    <div className="bg-surface-1 p-2 rounded border border-surface-divider">
                      <div className="text-surface-muted text-xs">Rentabilité</div>
                      <div className="font-semibold text-brand-sky">
                        {((prop.baseRent * prop.units * 12) / prop.price * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <button className="ui-btn ui-btn--info w-full text-sm">
                    Voir le dossier
                  </button>
                </div>
              </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

