"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { formatMoney } from "../../lib/format";

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
  const [kindFilter, setKindFilter] = useState<"ALL" | "MAISON" | "DUPLEX" | "TRIPLEX" | "SIXPLEX" | "TOUR">("ALL");
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [nickname, setNickname] = useState("");
  const [cash, setCash] = useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string>("");
  const [mortgageRate, setMortgageRate] = useState(0.05);
  const [downPaymentPercent, setDownPaymentPercent] = useState(0.2);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tease, setTease] = useState<string | null>(null);
  // Effacer automatiquement le message taquin après 5 secondes
  useEffect(() => {
    if (!tease) return;
    const id = setTimeout(() => setTease(null), 5000);
    return () => clearTimeout(id);
  }, [tease]);
  const [showHoldings, setShowHoldings] = useState(false);
  const [holdings, setHoldings] = useState<any[]>([]);
  const [refiOpenId, setRefiOpenId] = useState<string>("");
  const [refiRate, setRefiRate] = useState<number>(0);
  const [refiPct, setRefiPct] = useState<number>(0);
  const [refiMode, setRefiMode] = useState<"pct" | "ltv" | "amount">("pct");
  const [refiLtvTarget, setRefiLtvTarget] = useState<number>(80); // % de valeur, max 80
  const [refiAmount, setRefiAmount] = useState<number>(0); // $ cash-out direct
  const purchaseRef = useRef<HTMLDivElement | null>(null);
  const [economy, setEconomy] = useState<{ baseMortgageRate: number; appreciationAnnual: number; schedule: number[] } | null>(null);
  const [scenario, setScenario] = useState<"prudent" | "central" | "optimiste">("central");
  const [showProjection, setShowProjection] = useState(false);

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
    if (!showProjection || !holdings || holdings.length === 0) return [];
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
  }, [showProjection, holdings, economy, adjustedSchedule]);

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
        const data = await apiFetch<{ player: { id: string; nickname: string; cash: number } }>(`/api/games/${gameId}/me`);
        setPlayerId(data.player.id);
        if (data.player.nickname) setNickname(data.player.nickname);
        if (typeof data.player.cash === "number") setCash(data.player.cash);
      } catch {
        // Fallback mobile: si le cookie invité n'est pas envoyé (third‑party), tenter un join explicite qui réutilisera le joueur (pseudo=email)
        try {
          const j = await apiFetch<{ playerId: string }>(`/api/games/${gameId}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
          setPlayerId(j.playerId);
        } catch {}
      }
    })();
  }, [gameId, playerId]);

  // Recharger l'état joueur (ex: après un achat)
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

  const handleReplenish = useCallback(async () => {
    try {
      await apiFetch(`/api/properties/replenish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
      await loadTemplates();
      setMessage("Banque d'immeubles remplie.");
      setError(null);
    } catch (err) {
      setMessage(null);
      setError(err instanceof Error ? err.message : "Échec du remplissage");
    }
  }, [loadTemplates, gameId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);
  // Déduction du type depuis units
  const kindOf = (u?: number) => {
    const units = Number(u || 1);
    if (units >= 50) return "TOUR" as const;
    if (units === 6) return "SIXPLEX" as const;
    if (units === 3) return "TRIPLEX" as const;
    if (units === 2) return "DUPLEX" as const;
    return "MAISON" as const;
  };

  const filtered = useMemo(() => {
    if (kindFilter === "ALL") return templates;
    return templates.filter((t) => kindOf(t.units) === kindFilter);
  }, [templates, kindFilter]);


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
  setTease(null);
      // Rafraîchir la liste des immeubles disponibles (exclure celui acheté)
      loadTemplates();
      // Rafraîchir l'encaisse disponible
      loadPlayer();
    } catch (err) {
      setMessage(null);
      // Sur erreur (ex: 400 immeuble déjà vendu), rafraîchir la liste pour refléter l'état
      loadTemplates();
      const msg = err instanceof Error ? err.message : "Achat impossible";
      setError(msg);
      // Journaliser pour diagnostic (dev)
      try { console.debug("[Immobilier] Erreur achat brute:", msg); } catch {}
      try {
        // Chercher un pseudo entre quotes après "à": supporte vendu/achete/acheté et quotes ' ou ", ou sans quotes
        const re = /(vendu|achete|acheté)[\s\S]*?à\s+['\"]?([^'\"\n]+)['\"]?/i;
        const m = msg.match(re);
        if (m && m[2]) {
          const owner = m[2].trim();
          setTease(`😜 Haha ${owner} a déjà acheté !`);
        } else if (/déjà/i.test(msg) && /(vendu|achete|acheté)/i.test(msg)) {
          // Fallback: message générique si pas de pseudo
          setTease(`😜 Haha c'est déjà acheté !`);
        } else {
          setTease(null);
        }
      } catch { setTease(null); }
    }
  }, [gameId, playerId, selectedTemplate, mortgageRate, downPaymentPercent, loadTemplates, loadPlayer]);

  return (
    <main className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold">Immobilier</h2>
        <p className="text-sm text-neutral-300">Achetez, vendez et gérez vos immeubles.</p>
      </section>

      <section ref={purchaseRef} className="space-y-3">
        {/* Filtres rapides par type */}
        <div className="flex flex-wrap gap-2 text-xs">
          {([
            { k: "ALL", label: "Tous" },
            { k: "MAISON", label: "Maisons" },
            { k: "DUPLEX", label: "Duplex" },
            { k: "TRIPLEX", label: "Triplex" },
            { k: "SIXPLEX", label: "6‑plex" },
            { k: "TOUR", label: "Tours (50 log.)" },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setKindFilter(k as any)}
              className={`px-3 py-1.5 rounded border ${kindFilter === k ? 'bg-indigo-600 border-indigo-500' : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'}`}
            >{label}</button>
          ))}
        </div>
        {(nickname || cash != null) && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-300">
            {nickname && (
              <p>Pseudo: <span className="font-medium">{nickname}</span></p>
            )}
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
        )}

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
                  {tpl.name} — {tpl.city} ({formatMoney(tpl.price)})
                </option>
              ))}
            </select>
          </label>
        </div>

        <button onClick={handlePurchase} className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500">Acheter</button>
  <button onClick={loadTemplates} className="px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600">Actualiser les immeubles</button>
  <button onClick={handleReplenish} className="px-4 py-2 rounded bg-indigo-700 hover:bg-indigo-600">Remplir la banque (≥50)</button>
        <button
          onClick={async () => { setShowHoldings((v) => !v); if (!showHoldings) { await Promise.all([loadHoldings(), loadEconomy()]); } }}
          className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600"
        >
          {showHoldings ? "Masquer mon parc" : "Voir mon parc immobilier"}
        </button>
        
        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && (
          <div className="space-y-1">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </section>
      {/* Toast taquin éphémère */}
      {tease && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-900 border border-amber-500/60 text-amber-200 px-4 py-2 rounded shadow-lg animate-fade-in">
          {tease}
        </div>
      )}

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
                    {(() => {
                      const purchase = Number(h.purchasePrice ?? 0);
                      const current = Number(h.currentValue ?? 0);
                      const gainAbs = current - purchase;
                      const gainPct = purchase > 0 ? (gainAbs / purchase) * 100 : 0;
                      const cls = gainAbs >= 0 ? 'text-emerald-400' : 'text-red-400';
                      return (
                        <div className="space-y-0.5">
                          <p className="text-sm text-neutral-300">Prix d'achat: {purchase > 0 ? formatMoney(purchase) : 'n/a'}</p>
                          <p className="text-sm text-neutral-300">Valeur actuelle: {formatMoney(current)}</p>
                          {purchase > 0 && (
                            <p className="text-sm text-neutral-300">Gain: <span className={cls}>{gainAbs >= 0 ? '+' : ''}{formatMoney(Math.round(gainAbs))} ({gainPct.toFixed(2)}%)</span></p>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-sm text-neutral-300">Loyer actuel: {formatMoney(Number(h.currentRent ?? 0))}</p>
                    {(() => {
                      const value = Number(h.currentValue ?? 0) || 0;
                      const weeklyRent = Number(h.currentRent ?? 0) || 0;
                      const weeklyDebt = Number(h.weeklyPayment ?? 0) || 0;
                      const weeklyFixed = ((Number(h.template?.taxes ?? 0) + Number(h.template?.insurance ?? 0) + Number(h.template?.maintenance ?? 0)) / 52) || 0;
                      const netWeekly = weeklyRent - weeklyFixed - weeklyDebt;
                      const pct = (w: number) => (value > 0 ? (netWeekly * w) / value : 0);
                      const g1d = pct(1 / 7);
                      const g1w = pct(1);
                      const g1y = pct(52);
                      const cls = (v: number) => (v >= 0 ? 'text-emerald-400' : 'text-red-400');
                      return (
                        <p className="text-xs text-neutral-400" title="Rendement sur valeur actuelle en temps de jeu — 1j = 1/7 h, 1s = 1 h, 1 an = 52 h">
                          Rendement (jeu):
                          {" "}
                          <span className={cls(g1d)}>1j {(g1d * 100).toFixed(2)}%</span>
                          {" "}·{" "}
                          <span className={cls(g1w)}>1s {(g1w * 100).toFixed(2)}%</span>
                          {" "}·{" "}
                          <span className={cls(g1y)}>1 an {(g1y * 100).toFixed(2)}%</span>
                        </p>
                      );
                    })()}
                    <p className="text-xs text-neutral-500">Dette hypothécaire: {formatMoney(Number(h.mortgageDebt ?? 0))} — Taux: {(Number(h.mortgageRate ?? 0) * 100).toFixed(2)}%</p>

                    {/* Réhypothèque */}
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          const baseRate = typeof economy?.baseMortgageRate === 'number' ? Number(economy.baseMortgageRate) : Number(h.mortgageRate ?? 0);
                          setRefiOpenId((v) => v === h.id ? "" : h.id);
                          setRefiRate(baseRate || 0.05);
                          setRefiPct(0);
                        }}
                        className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-sm"
                      >
                        {refiOpenId === h.id ? "Annuler" : "Réhypothéquer"}
                      </button>
                      <button
                        onClick={async () => {
                          if (!gameId) return;
                          const ok = confirm("Vendre cet immeuble et récupérer le produit net?");
                          if (!ok) return;
                          try {
                            const res = await apiFetch<{ proceeds: number }>(`/api/games/${gameId}/properties/${h.id}/sell`, { method: 'POST' });
                            setMessage(`Immeuble vendu, produit net ${formatMoney(Math.round(res.proceeds))}`);
                            setError(null);
                            await Promise.all([loadHoldings(), loadPlayer(), loadTemplates()]);
                          } catch (err) {
                            setMessage(null);
                            setError(err instanceof Error ? err.message : 'Échec de la vente');
                          }
                        }}
                        className="ml-2 px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 text-sm"
                        title="Vendre l'immeuble et solder l'hypothèque"
                      >Vendre</button>
                    </div>

                        {refiOpenId === h.id && (
                      <div className="mt-2 rounded border border-neutral-800 bg-neutral-950 p-3 space-y-2">
                        {(() => {
                          const value = Number(h.currentValue ?? 0);
                          const debt = Number(h.mortgageDebt ?? 0);
                          const maxDebt = Math.round(value * 0.8);
                          const available = Math.max(0, maxDebt - debt);
                              // Déterminer le pourcentage effectif selon le mode
                              let effectivePct = refiPct;
                              if (refiMode === "ltv") {
                                const targetLtv = Math.max(0, Math.min(80, refiLtvTarget)) / 100; // 0..0.8
                                const desiredDebt = Math.min(maxDebt, Math.round(value * targetLtv));
                                effectivePct = debt > 0 ? Math.max(0, (desiredDebt - debt) / debt) : 0;
                              } else if (refiMode === "amount") {
                                const amt = Math.max(0, refiAmount);
                                effectivePct = debt > 0 ? Math.max(0, amt / debt) : 0;
                              }
                              const newDebt = Math.round(debt * (1 + (isFinite(effectivePct) ? effectivePct : 0)));
                          const cappedNewDebt = Math.min(newDebt, maxDebt);
                          const cashOut = Math.max(0, cappedNewDebt - debt);
                              const currentRate = Number(h.mortgageRate ?? 0);
                              const rateUnchanged = Math.abs((refiRate || currentRate) - currentRate) < 0.0005;
                              const disabled = (available <= 0) || (cashOut <= 0 && rateUnchanged);
                          return (
                            <>
                              <div className="text-xs text-neutral-300 flex flex-col gap-1">
                                <span>Max dette (80% LTV): {formatMoney(maxDebt)}</span>
                                <span>Encaisse possible (cash-out): {formatMoney(available)}</span>
                              </div>
                              <div className="grid md:grid-cols-3 gap-3 text-xs text-neutral-300">
                                <label className="flex flex-col gap-1">
                                  Mode de saisie
                                  <select value={refiMode} onChange={(e) => setRefiMode(e.target.value as any)} className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700">
                                    <option value="pct">% de la dette</option>
                                    <option value="ltv">LTV cible (%)</option>
                                    <option value="amount">Montant cash-out ($)</option>
                                  </select>
                                </label>
                                <label className="flex flex-col gap-1">
                                  Nouveau taux (%)
                                  <input type="number" min={0} max={15} step={0.01} value={Math.round(refiRate * 10000) / 100}
                                    onChange={(e) => setRefiRate(Math.max(0, Number(e.target.value) / 100))}
                                    className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700" />
                                </label>
                                {refiMode === "pct" && (
                                  <label className="flex flex-col gap-1">
                                    Cash-out (% de la dette)
                                    <input type="number" min={0} max={100} step={1} value={Math.round(refiPct * 100)}
                                      onChange={(e) => setRefiPct(Math.max(0, Math.min(1, Number(e.target.value) / 100)))}
                                      className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700" />
                                  </label>
                                )}
                                {refiMode === "ltv" && (
                                  <label className="flex flex-col gap-1">
                                    LTV cible (%)
                                    <input type="number" min={0} max={80} step={1} value={refiLtvTarget}
                                      onChange={(e) => setRefiLtvTarget(Math.max(0, Math.min(80, Number(e.target.value))))}
                                      className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700" />
                                  </label>
                                )}
                                {refiMode === "amount" && (
                                  <label className="flex flex-col gap-1">
                                    Montant cash-out ($)
                                    <input type="number" min={0} step={1000} value={refiAmount}
                                      onChange={(e) => setRefiAmount(Math.max(0, Number(e.target.value)))}
                                      className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700" />
                                  </label>
                                )}
                                <div className="flex flex-col gap-1">
                                  <span>Aperçu</span>
                                  <span className="text-neutral-400">Nouvelle dette: {formatMoney(cappedNewDebt)} · Cash-out: {formatMoney(cashOut)}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={async () => {
                                    try {
                                      await apiFetch(`/api/games/${gameId}/properties/${h.id}/refinance`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ newRate: refiRate, cashOutPercent: isFinite(effectivePct) ? effectivePct : 0 })
                                      });
                                      setMessage('Réhypothèque effectuée');
                                      setError(null);
                                      setRefiOpenId("");
                                      await Promise.all([loadHoldings(), loadPlayer()]);
                                    } catch (err) {
                                      setMessage(null);
                                      setError(err instanceof Error ? err.message : 'Échec du refinancement');
                                    }
                                  }}
                                  disabled={disabled}
                                  title={available <= 0 ? "Aucune marge disponible" : (cashOut <= 0 && rateUnchanged ? "Aucun changement (même taux et pas de cash-out)" : "")}
                                  className={`px-3 py-1.5 rounded text-sm ${disabled ? 'bg-neutral-700 text-neutral-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                                >
                                  Confirmer
                                </button>
                                <button onClick={() => setRefiOpenId("")} className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm">Annuler</button>
                              </div>
                              {/* Journal des réhypothèques */}
                              {Array.isArray(h.refinanceLogs) && h.refinanceLogs.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs text-neutral-400 mb-1">Journal (dernières réhypothèques)</div>
                                  <ul className="text-xs text-neutral-300 space-y-1">
                                    {h.refinanceLogs.map((r: any) => (
                                      <li key={r.id} className="flex items-center justify-between">
                                        <span>{new Date(r.at).toLocaleString()}</span>
                                        <span>+{formatMoney(Math.round(r.amount))} à {(Number(r.rate) * 100).toFixed(2)}%</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="mt-6 space-y-2">
                <button
                  className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-sm"
                  onClick={() => setShowProjection((v) => !v)}
                >
                  {showProjection ? "Masquer projection 10 ans" : "Afficher projection 10 ans"}
                </button>
                {showProjection && projection.length > 0 && (
                  <>
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
                  </>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Immeubles disponibles {templates.length ? <span className="text-sm text-neutral-400">({templates.length})</span> : null}</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((tpl) => (
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
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700">
                    {(() => {
                      const k = kindOf(tpl.units);
                      return k === 'TOUR' ? 'Tour' : k === 'SIXPLEX' ? '6‑plex' : k === 'TRIPLEX' ? 'Triplex' : k === 'DUPLEX' ? 'Duplex' : 'Maison';
                    })()}
                  </span>
                  <span className="text-sm text-neutral-400">{tpl.city}</span>
                </div>
              </div>
              <p className="text-sm text-neutral-300">Prix: {formatMoney(tpl.price)}</p>
              <p className="text-sm text-neutral-300">Loyer unitaire: {formatMoney(tpl.baseRent)} {tpl.units ? `× ${tpl.units} log.` : ''}</p>
              <p className="text-xs text-neutral-500">Charges: taxes {formatMoney(tpl.taxes)}/an, assurance {formatMoney(tpl.insurance)}/an, entretien {formatMoney(tpl.maintenance)}/an</p>
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
  const [showTplProjection, setShowTplProjection] = useState(false);
  const [vacancyRate, setVacancyRate] = useState<number>(0.05); // 5% par défaut
  const [reservePerUnitMonthly, setReservePerUnitMonthly] = useState<number>(50); // 50$/logement/mois par défaut

  const units = Math.max(1, Number(tpl.units ?? 1));
  const rentMonthlyGross = Number(tpl.baseRent ?? 0) * units;
  const vacancyMonthly = rentMonthlyGross * vacancyRate;
  const rentMonthly = Math.max(0, rentMonthlyGross - vacancyMonthly);
  const expensesAnnual = Number(tpl.taxes ?? 0) + Number(tpl.insurance ?? 0) + Number(tpl.maintenance ?? 0);
  const expensesMonthly = expensesAnnual / 12;
  const reservesMonthly = Math.max(0, reservePerUnitMonthly * units);
  const reservesAnnual = reservesMonthly * 12;
  const noiAnnual = Math.max(0, rentMonthly * 12 - expensesAnnual - reservesAnnual);
  const capRate = tpl.price ? noiAnnual / tpl.price : 0;

  const downPayment = tpl.price * downPaymentPercent;
  const loan = Math.max(0, tpl.price - downPayment);
  const weekly = computeWeeklyMortgage(loan, mortgageRate, 25);
  const monthlyPayment = (weekly * 52) / 12;
  const cashflowMonthly = rentMonthly - expensesMonthly - reservesMonthly - monthlyPayment;

  // Intérêt annuel approximatif sur le solde initial (année 1)
  const annualInterest = loan * mortgageRate;
  const roc = downPayment > 0 ? (noiAnnual - annualInterest) / downPayment : 0;

  // Projection 10 ans (à la demande)
  const data = useMemo(() => {
    if (!showTplProjection) return [] as { year: number; net: number }[];
    const schedule = (economy?.schedule && economy.schedule.length ? economy.schedule : Array.from({ length: 10 }, () => 0.02)).slice(0, 10);
    const YEARS = schedule.length;
    let value = Number(tpl.price);
    let debt = loan;
    const d: { year: number; net: number }[] = [];
    d.push({ year: 0, net: value - debt });
    for (let y = 1; y <= YEARS; y++) {
      const annualPayment = weekly * 52;
      const interest = debt * mortgageRate;
      const principal = Math.max(0, annualPayment - interest);
      debt = Math.max(0, debt - principal);
      value = value * (1 + (schedule[y - 1] ?? 0.02));
      d.push({ year: y, net: value - debt });
    }
    return d;
  }, [showTplProjection, economy, tpl.price, loan, weekly, mortgageRate]);

  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3 space-y-2">
      <h5 className="font-semibold text-sm">Bilan</h5>
      <div className="grid md:grid-cols-3 gap-3 text-xs text-neutral-300">
        <label className="flex flex-col gap-1">
          Vacance locative (%)
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(vacancyRate * 100)}
            onChange={(e) => setVacancyRate(Math.max(0, Math.min(1, Number(e.target.value) / 100)))}
            className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700"
          />
        </label>
        <label className="flex flex-col gap-1">
          Réserves entretien ($/logement/mois)
          <input
            type="number"
            min={0}
            step={5}
            value={reservePerUnitMonthly}
            onChange={(e) => setReservePerUnitMonthly(Math.max(0, Number(e.target.value)))}
            className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700"
          />
        </label>
        {economy && (
          <div className="flex flex-col gap-1">
            <span>Indexation (réf.)</span>
            <span className="text-neutral-400">Loyers ~{(Math.max(0, economy.appreciationAnnual) * 100).toFixed(1)}%/an · Charges ~2.0%/an</span>
          </div>
        )}
      </div>
      <ul className="text-xs text-neutral-300 grid md:grid-cols-2 gap-2">
        <li>Unités: {units}</li>
        <li>Loyer brut: {formatMoney(Math.round(rentMonthlyGross))}/mois — Vacance: {Math.round(vacancyRate * 100)}%</li>
        <li>Loyer effectif: {formatMoney(Math.round(rentMonthly))}/mois</li>
        <li>Charges: {formatMoney(Math.round(expensesMonthly))}/mois ({formatMoney(Math.round(expensesAnnual))}/an)</li>
        <li>Réserves: {formatMoney(Math.round(reservesMonthly))}/mois ({formatMoney(Math.round(reservesAnnual))}/an)</li>
        <li>NOI: {formatMoney(Math.round(noiAnnual))}/an · Cap rate: {(capRate * 100).toFixed(2)}%</li>
        <li>Mise de fonds: {formatMoney(Math.round(downPayment))} ({Math.round(downPaymentPercent * 100)}%)</li>
        <li>Hypothèque: {formatMoney(Math.round(loan))} — Paiement: {formatMoney(Math.round(monthlyPayment))}/mois</li>
        <li>Cashflow estimé: <span className={cashflowMonthly >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatMoney(Math.round(cashflowMonthly))}/mois</span></li>
        <li>Rendement sur capital (année 1): <span className={roc >= 0 ? 'text-emerald-400' : 'text-red-400'}>{(roc * 100).toFixed(2)}%</span></li>
      </ul>
      <div className="space-y-2">
        <button
          className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-xs"
          onClick={() => setShowTplProjection((v) => !v)}
        >
          {showTplProjection ? "Masquer projection 10 ans" : "Afficher projection 10 ans"}
        </button>
        {showTplProjection && (
          <>
            <h6 className="text-xs text-neutral-400 mb-1">Projection 10 ans (valeur nette)</h6>
            <ProjectionChart data={data} />
          </>
        )}
      </div>
    </div>
  );
}

