"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, DollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import RefinanceModal from "../_components/RefinanceModal";
import SellModal from "../_components/SellModal";

type Holding = {
  id: string;
  template: {
    id: string;
    name: string;
    city: string;
    imageUrl: string;
    baseRent: number;
    units: number;
    taxes: number;
    insurance: number;
    maintenance: number;
  };
  purchasePrice: number;
  mortgageDebt: number;
  mortgageRate: number;
  termYears: number;
  currentValue: number;
  currentRent: number;
  weeklyPayment: number;
  createdAt: string;
};

type PortfolioSummary = {
  totalValue: number;
  totalDebt: number;
  monthlyRent: number;
  monthlyDebt: number;
  monthlyFixed: number;
  monthlyNet: number;
  holdingsCount: number;
};

function ParcImmobilierContent() {
  const searchParams = useSearchParams();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [refinanceHolding, setRefinanceHolding] = useState<Holding | null>(null);
  const [sellHolding, setSellHolding] = useState<Holding | null>(null);

  useEffect(() => {
    const sessionStr = localStorage.getItem("hm-session");
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session.gameId) setGameId(session.gameId);
        if (session.playerId) setPlayerId(session.playerId);
      } catch {}
    }
    
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!gameId || !playerId) return;
    
    try {
      setLoading(true);
      
      // Charger le résumé
      const summaryData = await apiFetch<{ totals: PortfolioSummary }>(
        `/api/games/${gameId}/players/${playerId}/portfolio`
      );
      setSummary(summaryData.totals);

      // Charger la liste détaillée
      const holdingsData = await apiFetch<{ holdings: Holding[] }>(
        `/api/games/${gameId}/properties/holdings/${playerId}`
      );
      setHoldings(holdingsData.holdings);
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos propriétés");
    } finally {
      setLoading(false);
    }
  }, [gameId, playerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefinance = async (holdingId: string, newRate: number, newYears: number) => {
    if (!gameId) return;
    
    try {
      await apiFetch(`/api/games/${gameId}/properties/${holdingId}/refinance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRate: newRate / 100, // Backend attend 0.05 pour 5%
          newTermYears: newYears,
        }),
      });
      
      await loadData();
      setRefinanceHolding(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du refinancement");
      throw err;
    }
  };

  const handleSell = async (holdingId: string) => {
    if (!gameId) return;
    
    try {
      await apiFetch(`/api/games/${gameId}/properties/${holdingId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      await loadData();
      setSellHolding(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la vente");
      throw err;
    }
  };

  return (
    <main className="min-h-screen p-4 bg-neutral-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <Link href="/immobilier" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour à l'agence</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-100">🏢 Mon Parc Immobilier</h1>
        </div>

        {/* Message de succès */}
        {showSuccess && (
          <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4 text-emerald-300 animate-pulse">
            ✅ Opération réussie !
          </div>
        )}

        {loading && !summary && (
          <div className="text-center py-12 text-neutral-400">
            Chargement de votre portefeuille immobilier...
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && holdings.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <Building2 className="w-16 h-16 text-neutral-600 mx-auto" />
            <h3 className="text-xl font-semibold text-neutral-300">Aucune propriété pour le moment</h3>
            <p className="text-neutral-400">Commencez par rechercher et acheter votre premier immeuble !</p>
            <Link 
              href="/immobilier"
              className="inline-block px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Explorer les immeubles disponibles
            </Link>
          </div>
        )}

        {!loading && !error && summary && holdings.length > 0 && (
          <>
            {/* Résumé du portefeuille */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border border-emerald-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Valeur totale</h3>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{formatMoney(summary.totalValue)}</p>
                <p className="text-xs text-neutral-400 mt-1">{summary.holdingsCount} propriété(s)</p>
              </div>

              <div className="bg-gradient-to-br from-red-900/30 to-red-950/50 border border-red-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-6 h-6 text-red-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Dette totale</h3>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatMoney(summary.totalDebt)}</p>
                <p className="text-xs text-neutral-400 mt-1">Solde hypothécaire</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-950/50 border border-indigo-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Équité nette</h3>
                </div>
                <p className="text-2xl font-bold text-indigo-400">{formatMoney(summary.totalValue - summary.totalDebt)}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {summary.totalValue > 0 ? `${(((summary.totalValue - summary.totalDebt) / summary.totalValue) * 100).toFixed(1)}% du total` : "0%"}
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/50 border border-amber-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-6 h-6 text-amber-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Cashflow mensuel</h3>
                </div>
                <p className={`text-2xl font-bold ${summary.monthlyNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatMoney(summary.monthlyNet)}
                </p>
                <p className="text-xs text-neutral-400 mt-1">Revenus: {formatMoney(summary.monthlyRent)}</p>
              </div>
            </div>

            {/* Liste des propriétés */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-neutral-100">📋 Vos propriétés</h2>
              
              <div className="grid lg:grid-cols-2 gap-4">
                {holdings.map((holding) => {
                  const equity = holding.currentValue - holding.mortgageDebt;
                  const equityPercent = holding.currentValue > 0 ? (equity / holding.currentValue) * 100 : 0;
                  // Calcul approximatif du cashflow mensuel pour l'affichage individuel
                  // (Le backend donne le weeklyPayment, on convertit en mensuel)
                  const monthlyPayment = (holding.weeklyPayment * 52) / 12;
                  const monthlyRent = (holding.currentRent * 52) / 12; // currentRent est hebdo dans la DB ? Vérifier.
                  // Dans le backend: currentRent est stocké. Le endpoint portfolio calcule weeklyRent += h.currentRent.
                  // Donc currentRent est hebdomadaire.
                  
                  // Dépenses fixes mensuelles estimées
                  const annualFixed = holding.template.taxes + holding.template.insurance + holding.template.maintenance;
                  const monthlyFixed = annualFixed / 12;
                  const monthlyCashflow = monthlyRent - monthlyPayment - monthlyFixed;

                  return (
                    <div key={holding.id} className="border border-neutral-800 rounded-lg bg-neutral-900 overflow-hidden">
                      {holding.template.imageUrl && (
                        <div className="aspect-video w-full bg-neutral-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={holding.template.imageUrl} alt={holding.template.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      <div className="p-6 space-y-4">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-lg text-neutral-100">{holding.template.name}</h3>
                          </div>
                          <p className="text-sm text-neutral-400">{holding.template.city}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Acheté le {new Date(holding.createdAt).toLocaleDateString("fr-CA")}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Valeur actuelle</p>
                            <p className="font-semibold text-neutral-100">{formatMoney(holding.currentValue)}</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Hypothèque restante</p>
                            <p className="font-semibold text-red-400">{formatMoney(holding.mortgageDebt)}</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Équité</p>
                            <p className="font-semibold text-indigo-400">{formatMoney(equity)}</p>
                            <p className="text-xs text-neutral-500">{equityPercent.toFixed(1)}%</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Paiement mensuel</p>
                            <p className="font-semibold text-amber-400">{formatMoney(monthlyPayment)}</p>
                          </div>
                        </div>

                        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-neutral-300">Cashflow mensuel</span>
                            <span className={`font-bold ${monthlyCashflow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {formatMoney(monthlyCashflow)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-neutral-400">
                            <span>Loyer: {formatMoney(monthlyRent)}</span>
                            <span>Dépenses: {formatMoney(monthlyPayment + monthlyFixed)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setRefinanceHolding(holding)}
                            className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                          >
                            Refinancer
                          </button>
                          <button 
                            onClick={() => setSellHolding(holding)}
                            className="flex-1 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors"
                          >
                            Vendre
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bouton d'action */}
            <div className="text-center pt-6">
              <Link 
                href="/immobilier"
                className="inline-block px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                + Ajouter une propriété
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {refinanceHolding && (
        <RefinanceModal
          property={{
            id: refinanceHolding.id,
            name: refinanceHolding.template.name,
            currentValue: refinanceHolding.currentValue,
            remainingBalance: refinanceHolding.mortgageDebt,
            monthlyPayment: (refinanceHolding.weeklyPayment * 52) / 12,
            interestRate: refinanceHolding.mortgageRate * 100,
            quantity: 1,
          }}
          onClose={() => setRefinanceHolding(null)}
          onConfirm={handleRefinance}
        />
      )}

      {sellHolding && (
        <SellModal
          property={{
            id: sellHolding.id,
            name: sellHolding.template.name,
            city: sellHolding.template.city,
            currentValue: sellHolding.currentValue,
            purchasePrice: sellHolding.purchasePrice,
            remainingBalance: sellHolding.mortgageDebt,
            quantity: 1,
            imageUrl: sellHolding.template.imageUrl,
          }}
          onClose={() => setSellHolding(null)}
          onConfirm={(id, qty) => handleSell(id)}
        />
      )}
    </main>
  );
}

export default function ParcImmobilierPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-neutral-400">Chargement...</div>}>
      <ParcImmobilierContent />
    </Suspense>
  );
}
