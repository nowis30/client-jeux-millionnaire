"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import MortgageExplanation from "../_components/MortgageExplanation";
import AmortizationSchedule from "../_components/AmortizationSchedule";

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

function HypothequeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [interestRate, setInterestRate] = useState(5.5);
  const [amortizationYears, setAmortizationYears] = useState(25);
  const [purchasing, setPurchasing] = useState(false);

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
      
      // Si un immeuble est sélectionné dans l'URL, le charger
      const selectId = searchParams.get("select");
      if (selectId) {
        const found = data.templates.find(t => t.id === selectId);
        if (found) {
          setSelectedTemplate(found);
        }
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les immeubles");
    } finally {
      setLoading(false);
    }
  }, [gameId, searchParams]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const calculateMortgage = () => {
    if (!selectedTemplate) return { downPayment: 0, loanAmount: 0, monthlyPayment: 0, totalCost: 0 };
    
    const totalPrice = selectedTemplate.price * quantity;
    const downPayment = totalPrice * (downPaymentPercent / 100);
    const loanAmount = totalPrice - downPayment;
    
    // Calcul du paiement mensuel (formule standard d'hypothèque)
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = amortizationYears * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    const totalCost = monthlyPayment * numberOfPayments + downPayment;
    
    return { downPayment, loanAmount, monthlyPayment, totalCost };
  };

  const handlePurchase = async () => {
    if (!selectedTemplate || !gameId) return;
    
    try {
      setPurchasing(true);
      const mortgage = calculateMortgage();
      
      await apiFetch(`/api/properties/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          templateId: selectedTemplate.id,
          quantity,
          downPaymentPercent,
          interestRate,
          amortizationYears,
        }),
      });
      
      // Rediriger vers le parc immobilier après l'achat
      router.push("/immobilier/parc?success=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'achat");
      setPurchasing(false);
    }
  };

  const mortgage = calculateMortgage();
  const monthlyRent = selectedTemplate ? selectedTemplate.baseRent * (selectedTemplate.units || 1) * quantity : 0;
  const annualExpenses = selectedTemplate ? (selectedTemplate.taxes + selectedTemplate.insurance + selectedTemplate.maintenance) * quantity : 0;
  const monthlyCashflow = monthlyRent - (mortgage.monthlyPayment + annualExpenses / 12);

  return (
    <main className="min-h-screen p-4 bg-neutral-950">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <Link href="/immobilier/menu" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour au menu</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-100">🏦 Hypothèques et Financement</h1>
        </div>

        {/* Explication des hypothèques */}
        <MortgageExplanation />

        {loading && (
          <div className="text-center py-12 text-neutral-400">
            Chargement des options de financement...
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !selectedTemplate && (
          <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-4 text-amber-300">
            Aucun immeuble sélectionné. <Link href="/immobilier/recherche" className="underline">Recherchez un immeuble</Link> pour commencer.
          </div>
        )}

        {!loading && selectedTemplate && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Colonne gauche - Détails de l'immeuble */}
            <div className="space-y-4">
              <div className="border border-neutral-800 rounded-lg bg-neutral-900 p-6 space-y-4">
                <h3 className="text-xl font-bold text-neutral-100">🏢 Immeuble sélectionné</h3>
                
                {selectedTemplate.imageUrl && (
                  <div className="aspect-video w-full bg-neutral-800 rounded overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedTemplate.imageUrl} alt={selectedTemplate.name} className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-lg text-neutral-100">{selectedTemplate.name}</h4>
                  <p className="text-sm text-neutral-400">{selectedTemplate.city}</p>
                  {selectedTemplate.description && (
                    <p className="text-sm text-neutral-300">{selectedTemplate.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Prix unitaire</p>
                    <p className="font-semibold text-neutral-100">{formatMoney(selectedTemplate.price)}</p>
                  </div>
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Loyer/mois</p>
                    <p className="font-semibold text-emerald-400">{formatMoney(selectedTemplate.baseRent * (selectedTemplate.units || 1))}</p>
                  </div>
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Taxes/an</p>
                    <p className="font-semibold text-neutral-100">{formatMoney(selectedTemplate.taxes)}</p>
                  </div>
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Assurance/an</p>
                    <p className="font-semibold text-neutral-100">{formatMoney(selectedTemplate.insurance)}</p>
                  </div>
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Entretien/an</p>
                    <p className="font-semibold text-neutral-100">{formatMoney(selectedTemplate.maintenance)}</p>
                  </div>
                  <div className="bg-neutral-800/50 rounded p-3">
                    <p className="text-neutral-400">Logements</p>
                    <p className="font-semibold text-neutral-100">{selectedTemplate.units || 1}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-800">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Quantité d'immeubles</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 text-neutral-100"
                  />
                </div>

                <Link
                  href="/immobilier/recherche"
                  className="block w-full text-center px-4 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-white transition-colors"
                >
                  Choisir un autre immeuble
                </Link>
              </div>
            </div>

            {/* Colonne droite - Calculateur d'hypothèque */}
            <div className="space-y-4">
              <div className="border border-emerald-800 rounded-lg bg-emerald-900/20 p-6 space-y-4">
                <h3 className="text-xl font-bold text-emerald-200">💰 Calcul du financement</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Mise de fonds: {downPaymentPercent}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      step="5"
                      value={downPaymentPercent}
                      onChange={(e) => setDownPaymentPercent(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>10%</span>
                      <span>50%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Taux d'intérêt: {interestRate.toFixed(2)}%
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="10"
                      step="0.25"
                      value={interestRate}
                      onChange={(e) => setInterestRate(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>3%</span>
                      <span>10%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">
                      Amortissement: {amortizationYears} ans
                    </label>
                    <input
                      type="range"
                      min="15"
                      max="30"
                      step="5"
                      value={amortizationYears}
                      onChange={(e) => setAmortizationYears(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-neutral-400 mt-1">
                      <span>15 ans</span>
                      <span>30 ans</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-emerald-800/50 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Prix total ({quantity}×)</span>
                    <span className="font-semibold text-white">{formatMoney(selectedTemplate.price * quantity)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Mise de fonds</span>
                    <span className="font-semibold text-emerald-400">{formatMoney(mortgage.downPayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Montant hypothèque</span>
                    <span className="font-semibold text-amber-400">{formatMoney(mortgage.loanAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-emerald-800/50">
                    <span className="text-neutral-200">Paiement mensuel</span>
                    <span className="text-white">{formatMoney(mortgage.monthlyPayment)}</span>
                  </div>
                </div>

                <div className="bg-sky-900/30 border border-sky-700/50 rounded p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-sky-200">📊 Cashflow mensuel estimé</h4>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Revenus de loyers</span>
                    <span className="text-emerald-400">+{formatMoney(monthlyRent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Paiement hypothèque</span>
                    <span className="text-red-400">-{formatMoney(mortgage.monthlyPayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-300">Dépenses (taxes, ass., entr.)</span>
                    <span className="text-red-400">-{formatMoney(annualExpenses / 12)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t border-sky-700/50">
                    <span className="text-neutral-200">Cashflow net</span>
                    <span className={monthlyCashflow >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {formatMoney(monthlyCashflow)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePurchase}
                  disabled={purchasing || mortgage.downPayment > 0 && !gameId}
                  className="w-full px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                >
                  {purchasing ? "Achat en cours..." : `Acheter avec hypothèque (${formatMoney(mortgage.downPayment)} requis)`}
                </button>

                <p className="text-xs text-neutral-400 text-center">
                  Coût total sur {amortizationYears} ans: {formatMoney(mortgage.totalCost)}
                </p>
              </div>

              {/* Tableau d'amortissement */}
              {mortgage.loanAmount > 0 && (
                <AmortizationSchedule
                  loanAmount={mortgage.loanAmount}
                  interestRate={interestRate}
                  amortizationYears={amortizationYears}
                  monthlyPayment={mortgage.monthlyPayment}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function HypothequesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-400">Chargement...</p>
      </div>
    }>
      <HypothequeContent />
    </Suspense>
  );
}
