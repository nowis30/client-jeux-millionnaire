"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";

type Template = {
  id: string;
  name: string;
  city: string;
  price: number;
  baseRent: number;
  taxes: number;
  insurance: number;
  maintenance: number;
  imageUrl: string;
  description?: string;
  units?: number;
  plumbingState?: string;
  electricityState?: string;
  roofState?: string;
};

export default function RecherchePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("tous");

  useEffect(() => {
    const id = localStorage.getItem("hm-session");
    if (id) setGameId(id);
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
      const data = await apiFetch<{ templates: Template[] }>(`/api/properties/templates${query}`);
      setTemplates(data.templates ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les immeubles");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch = tpl.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tpl.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedType === "tous") return matchesSearch;
    
    const units = Number(tpl.units || 0);
    if (selectedType === "6plex") return matchesSearch && units === 6;
    if (selectedType === "tour50") return matchesSearch && units === 50;
    if (selectedType === "tour100") return matchesSearch && units === 100;
    if (selectedType === "gratte-ciel") return matchesSearch && units >= 400;
    if (selectedType === "village") return matchesSearch && units >= 800;
    
    return matchesSearch;
  });

  const kindOf = (units?: number) => {
    const u = Number(units ?? 0);
    if (u >= 800) return 'VILLAGE_FUTURISTE';
    if (u >= 400) return 'GRATTE_CIEL';
    if (u >= 50) return 'TOUR';
    if (u === 6) return 'SIXPLEX';
    if (u === 3) return 'TRIPLEX';
    if (u === 2) return 'DUPLEX';
    return 'MAISON';
  };

  return (
    <main className="min-h-screen p-4 bg-neutral-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <Link href="/immobilier/menu" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour au menu</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-100">🔍 Recherche d'immeubles</h1>
        </div>

        {/* Filtres */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Recherche</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nom ou ville..."
                className="w-full px-4 py-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Type d'immeuble</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 rounded bg-neutral-900 border border-neutral-700 text-neutral-100 focus:border-emerald-500 focus:outline-none"
              >
                <option value="tous">Tous ({templates.length})</option>
                <option value="6plex">6-plex ({templates.filter(t => Number(t.units || 0) === 6).length})</option>
                <option value="tour50">Tours 50 log. ({templates.filter(t => Number(t.units || 0) === 50).length})</option>
                <option value="tour100">Tours 100 log. ({templates.filter(t => Number(t.units || 0) === 100).length})</option>
                <option value="gratte-ciel">Gratte-ciel 400+ ({templates.filter(t => Number(t.units || 0) >= 400).length})</option>
                <option value="village">Villages futuristes 800+ ({templates.filter(t => Number(t.units || 0) >= 800).length})</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-neutral-400">
            {filteredTemplates.length} immeuble(s) trouvé(s)
          </div>
        </div>

        {/* Résultats */}
        {loading && (
          <div className="text-center py-12 text-neutral-400">
            Chargement des immeubles...
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filteredTemplates.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            Aucun immeuble ne correspond à vos critères
          </div>
        )}

        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((tpl) => (
              <article
                key={tpl.id}
                className="border border-neutral-800 rounded-lg bg-neutral-900 overflow-hidden hover:border-emerald-500/50 transition-all"
              >
                <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                  {(() => {
                    const k = kindOf(tpl.units);
                    if (k === 'GRATTE_CIEL') return <span className="text-xs">Pas de photo</span>;
                    if (tpl.imageUrl) return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tpl.imageUrl} alt={tpl.name} className="w-full h-full object-cover" />
                    );
                    return <span className="text-xs">Pas de photo</span>;
                  })()}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-neutral-100">{tpl.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                        {(() => {
                          const k = kindOf(tpl.units);
                          return k === 'VILLAGE_FUTURISTE' ? 'Village futuriste'
                            : k === 'GRATTE_CIEL' ? 'Gratte‑ciel'
                            : k === 'TOUR' ? 'Tour'
                            : k === 'SIXPLEX' ? '6‑plex'
                            : k === 'TRIPLEX' ? 'Triplex'
                            : k === 'DUPLEX' ? 'Duplex'
                            : 'Maison';
                        })()}
                      </span>
                      <span className="text-sm text-neutral-400">{tpl.city}</span>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-300">Prix: {formatMoney(tpl.price)}</p>
                  <p className="text-sm text-neutral-300">Loyer unitaire: {formatMoney(tpl.baseRent)} {tpl.units ? `× ${tpl.units} log.` : ''}</p>
                  {(() => {
                    const u = Number(tpl.units ?? 0);
                    if (u >= 800) return <p className="text-xs text-fuchsia-300">Village futuriste · Habitat autonome · Prix fixe stratégique</p>;
                    if (u >= 400) return <p className="text-xs text-indigo-300">100 étages · Centre commercial intégré · Multiplicateur 14–16× revenus</p>;
                    return null;
                  })()}
                  <p className="text-xs text-neutral-500">
                    Charges: taxes {formatMoney(tpl.taxes)}/an, assurance {formatMoney(tpl.insurance)}/an, entretien {formatMoney(tpl.maintenance)}/an
                  </p>
                  <p className="text-xs text-neutral-500">
                    État — Plomberie: {tpl.plumbingState ?? 'n/a'}, Électricité: {tpl.electricityState ?? 'n/a'}, Toiture: {tpl.roofState ?? 'n/a'}
                  </p>
                  {tpl.description && (
                    <p className="text-xs text-neutral-400 mt-1">{tpl.description}</p>
                  )}
                  <div className="pt-2">
                    <Link
                      href={`/immobilier/hypotheques?id=${tpl.id}`}
                      className="block w-full text-center px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                    >
                      Sélectionner pour achat
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
