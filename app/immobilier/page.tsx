"use client";
import { useCallback, useEffect, useState } from "react";
import { loadSession } from "../../lib/session";

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
  units?: number;
  plumbingState?: string;
  electricityState?: string;
  roofState?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export default function ImmobilierPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [mortgageRate, setMortgageRate] = useState(0.05);
  const [downPaymentPercent, setDownPaymentPercent] = useState(0.2);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      if (session.gameId) setGameId((prev) => prev || session.gameId);
      if (session.playerId) setPlayerId((prev) => prev || session.playerId);
    }
  }, []);

  // Tente de résoudre automatiquement le player via cookie invité
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

  const loadTemplates = useCallback(async () => {
    try {
      const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
      const res = await fetch(`${API_BASE}/api/properties/templates${query}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { templates: Template[] } = await res.json();
      setTemplates(data.templates ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les immeubles");
    }
  }, [gameId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handlePurchase = useCallback(async () => {
    if (!gameId || !playerId || !selectedTemplate) {
      setError("Renseignez gameId, playerId et immeuble");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/properties/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          templateId: selectedTemplate,
          mortgageRate,
          downPaymentPercent,
        }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data: { holdingId: string } = await res.json();
      setMessage(`Immeuble acheté! Holding ${data.holdingId}`);
      setError(null);
      // Rafraîchir la liste des immeubles disponibles (exclure celui acheté)
      loadTemplates();
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Achat impossible");
    }
  }, [gameId, playerId, selectedTemplate, mortgageRate, downPaymentPercent, loadTemplates]);

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Immobilier</h2>
        <p className="text-sm text-neutral-300">Achetez, vendez et gérez vos immeubles.</p>
      </section>

      <section className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Game ID
            <input
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
              placeholder="cuid de la partie"
            />
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Player ID
            <input
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
              placeholder="cuid du joueur"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Taux hypothécaire (ex: 0.05)
            <input
              type="number"
              step="0.005"
              value={mortgageRate}
              onChange={(e) => setMortgageRate(Number(e.target.value))}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            />
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Mise de fonds (%)
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(downPaymentPercent * 100)}
              onChange={(e) => setDownPaymentPercent(Number(e.target.value) / 100)}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            />
          </label>
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Immeuble sélectionné
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm"
            >
              <option value="">Choisir...</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} — {tpl.city} (${tpl.price.toLocaleString()})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button onClick={handlePurchase} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">Acheter</button>
        <button onClick={loadTemplates} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Actualiser les immeubles</button>
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
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Immeubles disponibles</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((tpl) => (
            <article key={tpl.id} className="border border-neutral-800 rounded-lg bg-neutral-900 overflow-hidden">
              <div className="aspect-video w-full bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tpl.imageUrl}
                  alt={tpl.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget as HTMLImageElement;
                    t.onerror = null;
                    t.src = "https://picsum.photos/640/360?blur=2";
                  }}
                />
              </div>
              <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">{tpl.name}</h4>
                <span className="text-sm text-neutral-400">{tpl.city}</span>
              </div>
              <p className="text-sm text-neutral-300">Prix: ${tpl.price.toLocaleString()}</p>
              <p className="text-sm text-neutral-300">Loyer unitaire: ${tpl.baseRent.toLocaleString()} {tpl.units ? `× ${tpl.units} log.` : ''}</p>
              <p className="text-xs text-neutral-500">Charges: taxes ${tpl.taxes}/an, assurance ${tpl.insurance}/an, entretien ${tpl.maintenance}/an</p>
              <p className="text-xs text-neutral-500">État — Plomberie: {tpl.plumbingState ?? 'n/a'}, Électricité: {tpl.electricityState ?? 'n/a'}, Toiture: {tpl.roofState ?? 'n/a'}</p>
              <button
                onClick={() => setSelectedTemplate(tpl.id)}
                className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm"
              >
                Sélectionner
              </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
