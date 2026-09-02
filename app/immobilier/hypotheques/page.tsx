"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Landmark, WalletCards } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";

type Template = {
  id: string;
  name: string;
  city?: string;
  price: number;
  baseRent: number;
  taxes: number;
  insurance: number;
  maintenance: number;
  imageUrl?: string;
  description?: string;
  units?: number;
  plumbingState?: string;
  electricityState?: string;
  roofState?: string;
};

type Economy = {
  baseMortgageRate?: number;
  inflationAnnual?: number;
  appreciationAnnual?: number;
};

const DOWN_PAYMENT_OPTIONS = [20, 25, 30, 40, 50] as const;
const TERM_OPTIONS = [15, 20, 25] as const;

function percent(value: number) {
  return `${value.toFixed(2).replace(/\.00$/, "")} %`;
}

function weeklyMortgage(principal: number, annualRate: number, years: number) {
  if (principal <= 0) return 0;
  const weeks = Math.max(1, Math.round(years * 52));
  const weeklyRate = annualRate / 52;
  if (weeklyRate === 0) return principal / weeks;
  return (principal * weeklyRate) / (1 - Math.pow(1 + weeklyRate, -weeks));
}

function HypothequeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [playerCash, setPlayerCash] = useState<number | null>(null);
  const [downPaymentPercent, setDownPaymentPercent] = useState<number>(20);
  const [interestRate, setInterestRate] = useState(5);
  const [amortizationYears, setAmortizationYears] = useState<number>(25);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("hm-session");
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session?.gameId) setGameId(String(session.gameId));
      if (session?.playerId) setPlayerId(String(session.playerId));
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
      const [propertyData, economyData] = await Promise.all([
        apiFetch<{ templates: Template[] }>(`/api/properties/templates${query}`),
        gameId
          ? apiFetch<Economy>(`/api/games/${gameId}/economy`).catch(() => ({} as Economy))
          : Promise.resolve({} as Economy),
      ]);

      const wantedId = searchParams.get("id") || searchParams.get("select");
      const found = propertyData.templates?.find((item) => item.id === wantedId) ?? null;
      if (found) {
        setSelectedTemplate(found);
      } else if (wantedId) {
        try {
          const single = await apiFetch<{ template: Template }>(`/api/properties/templates/${wantedId}`);
          setSelectedTemplate(single.template ?? null);
        } catch {
          setSelectedTemplate(null);
        }
      } else {
        setSelectedTemplate(null);
      }

      const rawRate = Number(economyData.baseMortgageRate);
      if (Number.isFinite(rawRate) && rawRate >= 0) {
        setInterestRate(rawRate <= 1 ? rawRate * 100 : rawRate);
      }

      if (gameId && playerId) {
        try {
          const portfolio = await apiFetch<any>(`/api/games/${gameId}/players/${playerId}/portfolio`);
          const cashCandidates = [portfolio?.cash, portfolio?.totals?.cash, portfolio?.playerCash, portfolio?.player?.cash];
          const cash = cashCandidates.map(Number).find(Number.isFinite);
          if (cash != null) setPlayerCash(cash);
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger le financement");
    } finally {
      setLoading(false);
    }
  }, [gameId, playerId, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const mortgage = useMemo(() => {
    if (!selectedTemplate) {
      return { downPayment: 0, loanAmount: 0, weeklyPayment: 0, monthlyPayment: 0, totalCost: 0 };
    }
    const price = Number(selectedTemplate.price || 0);
    const downPayment = price * (downPaymentPercent / 100);
    const loanAmount = Math.max(0, price - downPayment);
    const weeklyPayment = weeklyMortgage(loanAmount, interestRate / 100, amortizationYears);
    const monthlyPayment = weeklyPayment * 52 / 12;
    const totalCost = downPayment + weeklyPayment * amortizationYears * 52;
    return { downPayment, loanAmount, weeklyPayment, monthlyPayment, totalCost };
  }, [selectedTemplate, downPaymentPercent, interestRate, amortizationYears]);

  const monthlyRent = selectedTemplate
    ? Number(selectedTemplate.baseRent || 0) * Math.max(1, Number(selectedTemplate.units || 1))
    : 0;
  const annualExpenses = selectedTemplate
    ? Number(selectedTemplate.taxes || 0) + Number(selectedTemplate.insurance || 0) + Number(selectedTemplate.maintenance || 0)
    : 0;
  const monthlyFixed = annualExpenses / 12;
  const monthlyCashflow = monthlyRent - mortgage.monthlyPayment - monthlyFixed;
  const enoughCash = playerCash == null || playerCash >= mortgage.downPayment;

  const handlePurchase = async () => {
    if (!selectedTemplate || !gameId || !playerId || purchasing || !enoughCash) return;
    setPurchasing(true);
    setError(null);
    try {
      await apiFetch(`/api/games/${gameId}/properties/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          templateId: selectedTemplate.id,
          // Le taux vient de l'économie du jeu, pas d'un curseur choisi par le joueur.
          mortgageRate: interestRate / 100,
          downPaymentPercent,
          mortgageYears: amortizationYears,
        }),
      });
      router.push("/immobilier/parc?success=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'achat");
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-[72dvh] place-items-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/20 border-t-cyan-300" />
          <p className="text-sm font-semibold text-slate-300">Préparation du financement…</p>
        </div>
      </main>
    );
  }

  if (!selectedTemplate) {
    return (
      <main className="mx-auto max-w-lg px-4 pb-28 pt-6 sm:pb-8">
        <section className="ui-card p-6 text-center">
          <Landmark className="mx-auto h-10 w-10 text-cyan-300" />
          <h1 className="mt-3 text-xl font-black text-white">Choisis d'abord un immeuble</h1>
          <p className="mt-2 text-sm text-slate-400">Le financement s'ouvre ensuite avec les règles exactes de la partie.</p>
          <Link href="/immobilier" className="ui-btn ui-btn--info mt-5 w-full no-underline">Voir le marché</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-3 pb-28 pt-3 sm:px-6 sm:pb-8 sm:pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link href="/immobilier" className="ui-touch grid place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 no-underline" aria-label="Retour au marché">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300/70">Financement</p>
          <h1 className="truncate text-xl font-black text-white">{selectedTemplate.name}</h1>
        </div>
        {playerCash != null && (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-right">
            <div className="text-[9px] uppercase tracking-wide text-slate-500">Encaisse</div>
            <div className="text-xs font-black text-emerald-300">{formatMoney(playerCash)}</div>
          </div>
        )}
      </div>

      {error && <div className="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="overflow-hidden rounded-[24px] border border-white/10 bg-[#121722] shadow-xl">
          <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-b from-sky-950 to-slate-950">
            <img
              src={selectedTemplate.imageUrl || "/images/props/maison.svg"}
              alt=""
              className="h-full w-full object-cover"
              onError={(event) => { (event.currentTarget as HTMLImageElement).src = "/images/props/maison.svg"; }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10">
              <div className="text-2xl font-black text-white">{formatMoney(Number(selectedTemplate.price))}</div>
              <div className="text-xs text-slate-300">{selectedTemplate.city || "Québec"} · {Math.max(1, Number(selectedTemplate.units || 1))} logement{Number(selectedTemplate.units || 1) > 1 ? "s" : ""}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3">
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <div className="text-[9px] uppercase text-slate-500">Loyers</div>
              <div className="mt-0.5 text-xs font-black text-emerald-300">{formatMoney(monthlyRent)}/m</div>
            </div>
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <div className="text-[9px] uppercase text-slate-500">Dépenses</div>
              <div className="mt-0.5 text-xs font-black text-rose-200">{formatMoney(monthlyFixed)}/m</div>
            </div>
            <div className="rounded-xl bg-black/20 p-2 text-center">
              <div className="text-[9px] uppercase text-slate-500">Taux jeu</div>
              <div className="mt-0.5 text-xs font-black text-cyan-200">{percent(interestRate)}</div>
            </div>
          </div>
        </section>

        <section className="ui-card p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
            <div>
              <h2 className="text-sm font-black text-white">Taux fixé par l'économie</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">Le joueur choisit sa mise de fonds et sa durée. Le taux hypothécaire, lui, suit la partie et ne peut plus être baissé avec un curseur.</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Mise de fonds</span>
              <span className="text-sm font-black text-emerald-300">{downPaymentPercent}% · {formatMoney(mortgage.downPayment)}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {DOWN_PAYMENT_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDownPaymentPercent(value)}
                  className={`min-h-10 rounded-xl border text-xs font-black ${downPaymentPercent === value ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-200" : "border-white/10 bg-white/[0.03] text-slate-400"}`}
                >
                  {value}%
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">Minimum du jeu : 20 %. Plus tu verses, moins la dette et le paiement sont élevés.</p>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Amortissement</span>
              <span className="text-sm font-black text-cyan-200">{amortizationYears} ans</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TERM_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmortizationYears(value)}
                  className={`min-h-11 rounded-xl border text-xs font-black ${amortizationYears === value ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400"}`}
                >
                  {value} ans
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Hypothèque</div>
              <div className="mt-1 text-base font-black text-white">{formatMoney(mortgage.loanAmount)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Paiement / mois</div>
              <div className="mt-1 text-base font-black text-amber-200">{formatMoney(mortgage.monthlyPayment)}</div>
            </div>
          </div>

          <div className={`mt-3 rounded-2xl border p-3 ${monthlyCashflow >= 0 ? "border-emerald-300/20 bg-emerald-400/[0.07]" : "border-rose-300/20 bg-rose-400/[0.07]"}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cashflow estimé</div>
                <div className={`mt-0.5 text-2xl font-black ${monthlyCashflow >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {monthlyCashflow >= 0 ? "+" : ""}{formatMoney(monthlyCashflow)}/mois
                </div>
              </div>
              <div className="text-right text-[10px] leading-5 text-slate-400">
                <div>+ {formatMoney(monthlyRent)} loyers</div>
                <div>− {formatMoney(mortgage.monthlyPayment)} dette</div>
                <div>− {formatMoney(monthlyFixed)} frais</div>
              </div>
            </div>
          </div>

          {!enoughCash && playerCash != null && (
            <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
              Il manque {formatMoney(Math.max(0, mortgage.downPayment - playerCash))} d'encaisse pour cette mise de fonds.
            </div>
          )}

          <button
            type="button"
            onClick={() => void handlePurchase()}
            disabled={purchasing || !gameId || !playerId || !enoughCash}
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-300 px-4 text-base font-black text-slate-950 shadow-xl transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {purchasing ? (
              "Achat en cours…"
            ) : (
              <><CheckCircle2 className="h-5 w-5" /> Acheter · {formatMoney(mortgage.downPayment)} comptant</>
            )}
          </button>

          <details className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-xs text-slate-400">
            <summary className="cursor-pointer font-bold text-slate-300">Voir le coût du financement</summary>
            <div className="mt-2 grid grid-cols-2 gap-y-1">
              <span>Taux annuel</span><strong className="text-right text-slate-200">{percent(interestRate)}</strong>
              <span>Paiement / semaine</span><strong className="text-right text-slate-200">{formatMoney(mortgage.weeklyPayment)}</strong>
              <span>Durée</span><strong className="text-right text-slate-200">{amortizationYears} ans</strong>
              <span>Coût total estimé</span><strong className="text-right text-slate-200">{formatMoney(mortgage.totalCost)}</strong>
            </div>
          </details>
        </section>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-600">
        <WalletCards className="h-3.5 w-3.5" /> Les paiements utilisent la même formule hebdomadaire que le moteur du jeu.
      </div>
    </main>
  );
}

export default function HypothequesPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[70dvh] place-items-center text-sm text-slate-400">Chargement…</div>}>
      <HypothequeContent />
    </Suspense>
  );
}
