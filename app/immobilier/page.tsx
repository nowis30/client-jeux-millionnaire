"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

export default function ImmobilierPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string>("");
  const [mortgageRate, setMortgageRate] = useState(0.05);
  const [downPaymentPercent, setDownPaymentPercent] = useState(0.2);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHoldings, setShowHoldings] = useState(false);
  const [holdings, setHoldings] = useState<any[]>([]);
  const purchaseRef = useRef<HTMLDivElement | null>(null);
  const [economy, setEconomy] = useState<{ baseMortgageRate: number; appreciationAnnual: number; schedule: number[] } | null>(null);
  const [scenario, setScenario] = useState<"prudent" | "central" | "optimiste">("central");

  // Préparer les cookies cross‑site (hm_guest + hm_csrf) le plus tôt possible
  useEffect(() => {
    (async () => {
      try {
        await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
      } catch {}
    })();
  }, []);

  // --- Helpers projection 10 ans ---
  const formatCurrency = (n: number) => {
    if (!isFinite(n)) return "$0";
    return n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)} M$`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)} k$`
      : `$${Math.round(n)}`;
  };

  type YearPoint = { year: number; net: number };
  const adjustedSchedule = useMemo(() => {
    const base = economy?.schedule ?? [];
    if (!base.length) return [] as number[];
    const delta = scenario === "prudent" ? -0.005 : scenario === "optimiste" ? 0.005 : 0;
    return base.map((v) => Math.max(0.02, Math.min(0.05, v + delta)));
  }, [economy, scenario]);

  const projection: YearPoint[] = useMemo(() => {
    if (!holdings || holdings.length === 0) return [];
    const YEARS = 10;
    const schedule = adjustedSchedule.length ? adjustedSchedule : Array.from({ length: YEARS }, () => 0.02);
    const usedRate = economy?.baseMortgageRate ?? 0.05;
    // Copie mutable des valeurs pour simulation
    const sims = holdings.map((h) => ({
      value: Number(h.currentValue ?? 0),
      debt: Number(h.mortgageDebt ?? 0),
      rate: usedRate,
      payW: Number(h.weeklyPayment ?? 0),
    }));
    const out: YearPoint[] = [];
    let net0 = sims.reduce((sum, s) => sum + (s.value - s.debt), 0);
    out.push({ year: 0, net: net0 });
    for (let y = 1; y <= YEARS; y++) {
      for (const s of sims) {
        const annualPayment = s.payW * 52;
        const interest = s.debt * s.rate;
        const principal = Math.max(0, annualPayment - interest);
        s.debt = Math.max(0, s.debt - principal);
        s.value = s.value * (1 + (schedule[y - 1] ?? 0.02));
      }
      const net = sims.reduce((sum, s) => sum + (s.value - s.debt), 0);
      out.push({ year: y, net });
    }
    return out;
  }, [holdings, economy, adjustedSchedule]);

  // Résolution automatique du gameId global puis du player (via cookie invité/auth)
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

  // Tente de résoudre automatiquement le player via cookie invité
  useEffect(() => {
    if (!gameId || playerId) return;
    (async () => {
      try {
        const data = await apiFetch<{ player: { id: string; nickname: string } }>(`/api/games/${gameId}/me`);
        setPlayerId(data.player.id);
        if (data.player.nickname) setNickname(data.player.nickname);
      } catch {
        // Fallback mobile: si le cookie invité n'est pas envoyé (third‑party), tenter un join explicite qui réutilisera le joueur (pseudo=email)
        try {
          const j = await apiFetch<{ playerId: string }>(`/api/games/${gameId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          setPlayerId(j.playerId);
        } catch {}
      }
    })();
  }, [gameId, playerId]);

  const loadTemplates = useCallback(async () => {
    try {
      const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
      const data = await apiFetch<{ templates: Template[] }>(`/api/properties/templates${query}`);
      setTemplates(data.templates ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les immeubles");
    }
  }, [gameId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // (déplacé plus bas après la déclaration de loadEconomy)

  const loadHoldings = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/properties/holdings/${playerId}`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setHoldings(data.holdings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le parc immobilier");
    }
  }, [gameId, playerId]);

  const loadEconomy = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${API_BASE}/api/games/${gameId}/economy`);
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setEconomy(data);
      // Synchroniser le champ de taux hypothécaire du formulaire avec le taux courant du jeu
      if (typeof data?.baseMortgageRate === "number") {
        setMortgageRate(Number(data.baseMortgageRate));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les paramètres économiques");
    }
  }, [gameId]);

  // Charger l'économie globale tôt pour alimenter les prévisualisations
  useEffect(() => {
    (async () => { if (gameId) await loadEconomy(); })();
  }, [gameId, loadEconomy]);

  const handlePurchase = useCallback(async () => {
    if (!gameId || !playerId || !selectedTemplate) {
      setError("Sélectionnez un immeuble");
      return;
    }
    try {
      await apiFetch(`/api/games/${gameId}/properties/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          templateId: selectedTemplate,
          mortgageRate,
          downPaymentPercent,
        }),
      });
      setMessage(`Immeuble acheté!`);
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

      <section ref={purchaseRef} className="space-y-3">
        {nickname && <p className="text-sm text-neutral-300">Pseudo: <span className="font-medium">{nickname}</span></p>}

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm text-neutral-300 flex flex-col gap-1">
            Taux hypothécaire (défini par le jeu)
            <input
              type="number"
              step="0.0001"
              value={mortgageRate}
              readOnly
              className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm opacity-80 cursor-not-allowed"
              title="Le taux est variable et défini par le jeu (2% à 7%), ajusté mensuellement par pas de 0.25%."
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
          onClick={async () => { setShowHoldings((v) => !v); if (!showHoldings) { await Promise.all([loadHoldings(), loadEconomy()]); } }}
          className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600"
        >
          {showHoldings ? "Masquer mon parc" : "Voir mon parc immobilier"}
        </button>
        
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </section>

      {showHoldings && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold">Mon parc immobilier</h3>
          {holdings.length === 0 ? (
            <p className="text-sm text-neutral-400">Aucun bien pour le moment.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {holdings.map((h) => (
                  <article key={h.id} className="border border-neutral-800 rounded-lg bg-neutral-900 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{h.template?.name ?? "Bien"}</h4>
                      <span className="text-sm text-neutral-400">{h.template?.city ?? ""}</span>
                    </div>
                    <p className="text-sm text-neutral-300">Valeur actuelle: ${Number(h.currentValue ?? 0).toLocaleString()}</p>
                    <p className="text-sm text-neutral-300">Loyer actuel: ${Number(h.currentRent ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-neutral-500">Dette hypothécaire: ${Number(h.mortgageDebt ?? 0).toLocaleString()} — Taux: {(Number(h.mortgageRate ?? 0) * 100).toFixed(2)}%</p>
                  </article>
                ))}
              </div>

              {projection.length > 0 && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-md font-semibold">Projection 10 ans (valeur nette immobilière)</h4>
                    <span className="text-sm text-neutral-400">De {formatCurrency(projection[0].net)} à {formatCurrency(projection[projection.length - 1].net)}</span>
                  </div>
                  {economy && (
                    <div className="flex flex-wrap items-end gap-3 mb-2">
                      <label className="text-sm text-neutral-300 flex flex-col gap-1">
                        Scénario
                        <select value={scenario} onChange={(e) => setScenario(e.target.value as any)} className="px-3 py-2 rounded bg-neutral-900 border border-neutral-700 text-sm">
                          <option value="prudent">Prudent (biais -0,5 pt)</option>
                          <option value="central">Central</option>
                          <option value="optimiste">Optimiste (biais +0,5 pt)</option>
                        </select>
                      </label>
                      <div className="text-xs text-neutral-400">
                        Taux jeu actuel: {(economy.baseMortgageRate * 100).toFixed(2)}% · Appréciation courante: {(economy.appreciationAnnual * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                  <ProjectionChart data={projection} />
                  {adjustedSchedule.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="mt-3 w-full text-sm bg-neutral-900 border border-neutral-800 rounded">
                        <thead>
                          <tr className="text-left">
                            <th className="p-2">Année</th>
                            <th className="p-2">Appréciation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adjustedSchedule.map((v, i) => (
                            <tr key={i} className="border-t border-neutral-800">
                              <td className="p-2">{i + 1}</td>
                              <td className="p-2">{(v * 100).toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Immeubles disponibles {templates.length ? <span className="text-sm text-neutral-400">({templates.length})</span> : null}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((tpl) => (
            <article
              key={tpl.id}
              className="border border-neutral-800 rounded-lg bg-neutral-900 overflow-hidden"
            >
              <div className="aspect-video w-full bg-neutral-800 flex items-center justify-center text-neutral-500">
                {tpl.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tpl.imageUrl} alt={tpl.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs">Pas de photo</span>
                )}
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
              {tpl.description && (
                <p className="text-xs text-neutral-400 mt-1">{tpl.description}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedTemplate(tpl.id); if (purchaseRef.current) purchaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm"
                >
                  Sélectionner
                </button>
                <button
                  onClick={() => setExpandedTemplateId((v) => v === tpl.id ? "" : tpl.id)}
                  className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
                >
                  {expandedTemplateId === tpl.id ? "Masquer bilan" : "Voir bilan"}
                </button>
              </div>

              {expandedTemplateId === tpl.id && (
                <TemplatePreview
                  tpl={tpl}
                  mortgageRate={mortgageRate}
                  downPaymentPercent={downPaymentPercent}
                  economy={economy}
                />
              )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

// Petit graphique SVG inline, responsive
function ProjectionChart({ data }: { data: { year: number; net: number }[] }) {
  const w = 800, h = 200, pad = 28;
  const minY = Math.min(...data.map((d) => d.net));
  const maxY = Math.max(...data.map((d) => d.net));
  const y0 = minY === maxY ? minY * 0.95 : minY * 0.98;
  const y1 = minY === maxY ? maxY * 1.05 : maxY * 1.02;
  const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v: number) => h - pad - ((v - y0) * (h - pad * 2)) / Math.max(1, (y1 - y0));
  const points = data.map((d, i) => `${x(i)},${y(d.net)}`).join(" ");
  const ticks = [0, 2, 4, 6, 8, 10];

  const fmt = (n: number) => {
    if (!isFinite(n)) return "$0";
    return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M$` : n >= 1_000 ? `${(n / 1_000).toFixed(1)} k$` : `$${Math.round(n)}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48 bg-neutral-950 border border-neutral-800 rounded">
        {/* Axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#333" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#333" />
        {/* Y labels */}
        <text x={pad} y={pad - 8} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y1)}</text>
        <text x={pad} y={h - pad + 12} fill="#9ca3af" fontSize="10" textAnchor="start">{fmt(y0)}</text>
        {/* X ticks */}
        {ticks.map((t) => {
          const xi = x((t / 10) * (data.length - 1));
          return (
            <g key={t}>
              <line x1={xi} y1={h - pad} x2={xi} y2={h - pad + 4} stroke="#555" />
              <text x={xi} y={h - pad + 14} fill="#9ca3af" fontSize="10" textAnchor="middle">{t} ans</text>
            </g>
          );
        })}
        {/* Courbe */}
        <polyline fill="none" stroke="#22c55e" strokeWidth={2} points={points} />
        {/* Points */}
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.net)} r={2} fill="#22c55e" />
        ))}
      </svg>
    </div>
  );
}

// Paiement hebdo sur 25 ans (approximation): r = taux annuel/52, n = 52*années
function computeWeeklyMortgage(principal: number, annualRate: number, years = 25): number {
  const n = Math.max(1, Math.round(52 * years));
  const r = annualRate / 52;
  if (principal <= 0) return 0;
  if (r <= 0) return principal / n;
  const a = r * principal;
  const b = 1 - Math.pow(1 + r, -n);
  return a / b;
}

function TemplatePreview({
  tpl,
  mortgageRate,
  downPaymentPercent,
  economy,
}: {
  tpl: Template;
  mortgageRate: number;
  downPaymentPercent: number;
  economy: { baseMortgageRate: number; appreciationAnnual: number; schedule: number[] } | null;
}) {
  const units = Math.max(1, Number(tpl.units ?? 1));
  const rentMonthly = Number(tpl.baseRent ?? 0) * units;
  const expensesAnnual = Number(tpl.taxes ?? 0) + Number(tpl.insurance ?? 0) + Number(tpl.maintenance ?? 0);
  const expensesMonthly = expensesAnnual / 12;
  const noiAnnual = Math.max(0, rentMonthly * 12 - expensesAnnual);
  const capRate = tpl.price ? noiAnnual / tpl.price : 0;

  const downPayment = tpl.price * downPaymentPercent;
  const loan = Math.max(0, tpl.price - downPayment);
  const weekly = computeWeeklyMortgage(loan, mortgageRate, 25);
  const monthlyPayment = (weekly * 52) / 12;
  const cashflowMonthly = rentMonthly - expensesMonthly - monthlyPayment;

  // Projection 10 ans sur valeur nette = valeur - dette
  const schedule = (economy?.schedule && economy.schedule.length ? economy.schedule : Array.from({ length: 10 }, () => 0.02)).slice(0, 10);
  const YEARS = schedule.length;
  let value = Number(tpl.price);
  let debt = loan;
  const data: { year: number; net: number }[] = [];
  data.push({ year: 0, net: value - debt });
  for (let y = 1; y <= YEARS; y++) {
    // amortissement annuel approximé
    const annualPayment = weekly * 52;
    const interest = debt * mortgageRate;
    const principal = Math.max(0, annualPayment - interest);
    debt = Math.max(0, debt - principal);
    // appréciation de la valeur
    value = value * (1 + (schedule[y - 1] ?? 0.02));
    data.push({ year: y, net: value - debt });
  }

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3 space-y-2">
      <h5 className="font-semibold text-sm">Bilan</h5>
      <ul className="text-xs text-neutral-300 grid md:grid-cols-2 gap-2">
        <li>Unités: {units}</li>
        <li>Loyer total: ${fmt(rentMonthly)}/mois</li>
        <li>Charges: ${fmt(Math.round(expensesMonthly))}/mois ({fmt(Math.round(expensesAnnual))}/an)</li>
        <li>NOI: ${fmt(Math.round(noiAnnual))}/an · Cap rate: {(capRate * 100).toFixed(2)}%</li>
        <li>Mise de fonds: ${fmt(Math.round(downPayment))} ({Math.round(downPaymentPercent * 100)}%)</li>
        <li>Hypothèque: ${fmt(Math.round(loan))} — Paiement: ${fmt(Math.round(monthlyPayment))}/mois</li>
        <li>Cashflow estimé: <span className={cashflowMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}>${fmt(Math.round(cashflowMonthly))}/mois</span></li>
      </ul>
      <div>
        <h6 className="text-xs text-neutral-400 mb-1">Projection 10 ans (valeur nette)</h6>
        <ProjectionChart data={data} />
      </div>
    </div>
  );
}

