"use client";
import { useState, useEffect, useCallback } from "react";
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

export default function ImmobilierPage() {
  const router = useRouter();
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PropertyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="ui-btn ui-btn--neutral text-sm"
          >
            ← Retour
          </button>
          <h1 className="text-xl font-bold text-center bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Agence Immobilière
          </h1>
          <button
            onClick={() => router.push("/immobilier/parc")}
            className="ui-btn ui-btn--info text-sm font-bold"
          >
            Mon Parc
          </button>
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
            {templates.map((prop) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

