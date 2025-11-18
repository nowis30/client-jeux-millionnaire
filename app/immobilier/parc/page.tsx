"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, DollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { formatMoney } from "../../../lib/format";
import RefinanceModal from "../_components/RefinanceModal";
import SellModal from "../_components/SellModal";

type Property = {
  id: string;
  templateId: string;
  name: string;
  city: string;
  purchasePrice: number;
  currentValue: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  interestRate: number;
  amortizationYears: number;
  remainingBalance: number;
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
  quantity: number;
  imageUrl?: string;
  purchaseDate: string;
};

export default function ParcImmobilierPage() {
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [refinanceProperty, setRefinanceProperty] = useState<Property | null>(null);
  const [sellProperty, setSellProperty] = useState<Property | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("hm-session");
    if (id) setGameId(id);
    
    // Afficher le message de succès si présent dans l'URL
    if (searchParams.get("success") === "true") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams]);

  const loadProperties = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setLoading(true);
      const data = await apiFetch<{ properties: Property[] }>(`/api/properties/owned?gameId=${encodeURIComponent(gameId)}`);
      setProperties(data.properties ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos propriétés");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    if (gameId) {
      loadProperties();
    }
  }, [gameId, loadProperties]);

  const handleRefinance = async (propertyId: string, newRate: number, newYears: number) => {
    if (!gameId) return;
    
    try {
      await apiFetch(`/api/properties/refinance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          propertyId,
          newInterestRate: newRate,
          newAmortizationYears: newYears,
        }),
      });
      
      // Recharger les propriétés
      await loadProperties();
      setRefinanceProperty(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du refinancement");
      throw err;
    }
  };

  const handleSell = async (propertyId: string, quantityToSell: number) => {
    if (!gameId) return;
    
    try {
      await apiFetch(`/api/properties/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          propertyId,
          quantity: quantityToSell,
        }),
      });
      
      // Recharger les propriétés
      await loadProperties();
      setSellProperty(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la vente");
      throw err;
    }
  };

  const totalValue = properties.reduce((sum, p) => sum + p.currentValue * p.quantity, 0);
  const totalDebt = properties.reduce((sum, p) => sum + p.remainingBalance * p.quantity, 0);
  const totalEquity = totalValue - totalDebt;
  const totalMonthlyCashflow = properties.reduce((sum, p) => sum + p.monthlyCashflow * p.quantity, 0);
  const totalMonthlyRent = properties.reduce((sum, p) => sum + p.monthlyRent * p.quantity, 0);

  return (
    <main className="min-h-screen p-4 bg-neutral-950">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <Link href="/immobilier/menu" className="flex items-center gap-2 text-neutral-400 hover:text-neutral-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Retour au menu</span>
          </Link>
          <h1 className="text-3xl font-bold text-neutral-100">🏢 Mon Parc Immobilier</h1>
        </div>

        {/* Message de succès */}
        {showSuccess && (
          <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg p-4 text-emerald-300 animate-pulse">
            ✅ Félicitations ! Votre achat a été réalisé avec succès.
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-neutral-400">
            Chargement de votre portefeuille immobilier...
          </div>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && properties.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <Building2 className="w-16 h-16 text-neutral-600 mx-auto" />
            <h3 className="text-xl font-semibold text-neutral-300">Aucune propriété pour le moment</h3>
            <p className="text-neutral-400">Commencez par rechercher et acheter votre premier immeuble !</p>
            <Link 
              href="/immobilier/recherche"
              className="inline-block px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              Explorer les immeubles disponibles
            </Link>
          </div>
        )}

        {!loading && !error && properties.length > 0 && (
          <>
            {/* Résumé du portefeuille */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border border-emerald-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Valeur totale</h3>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{formatMoney(totalValue)}</p>
                <p className="text-xs text-neutral-400 mt-1">{properties.length} propriété(s)</p>
              </div>

              <div className="bg-gradient-to-br from-red-900/30 to-red-950/50 border border-red-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-6 h-6 text-red-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Dette totale</h3>
                </div>
                <p className="text-2xl font-bold text-red-400">{formatMoney(totalDebt)}</p>
                <p className="text-xs text-neutral-400 mt-1">Solde hypothécaire</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-900/30 to-indigo-950/50 border border-indigo-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-indigo-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Équité nette</h3>
                </div>
                <p className="text-2xl font-bold text-indigo-400">{formatMoney(totalEquity)}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {totalValue > 0 ? `${((totalEquity / totalValue) * 100).toFixed(1)}% du total` : "0%"}
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-900/30 to-amber-950/50 border border-amber-700/30 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                  <RefreshCw className="w-6 h-6 text-amber-400" />
                  <h3 className="text-sm font-medium text-neutral-300">Cashflow mensuel</h3>
                </div>
                <p className={`text-2xl font-bold ${totalMonthlyCashflow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatMoney(totalMonthlyCashflow)}
                </p>
                <p className="text-xs text-neutral-400 mt-1">Revenus: {formatMoney(totalMonthlyRent)}</p>
              </div>
            </div>

            {/* Liste des propriétés */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-neutral-100">📋 Vos propriétés</h2>
              
              <div className="grid lg:grid-cols-2 gap-4">
                {properties.map((property) => {
                  const equity = (property.currentValue - property.remainingBalance) * property.quantity;
                  const equityPercent = property.currentValue > 0 ? (equity / (property.currentValue * property.quantity)) * 100 : 0;
                  
                  return (
                    <div key={property.id} className="border border-neutral-800 rounded-lg bg-neutral-900 overflow-hidden">
                      {property.imageUrl && (
                        <div className="aspect-video w-full bg-neutral-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={property.imageUrl} alt={property.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      <div className="p-6 space-y-4">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-lg text-neutral-100">{property.name}</h3>
                            {property.quantity > 1 && (
                              <span className="px-2 py-1 rounded bg-amber-900/30 text-amber-400 text-xs font-semibold">
                                ×{property.quantity}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-400">{property.city}</p>
                          <p className="text-xs text-neutral-500 mt-1">
                            Acheté le {new Date(property.purchaseDate).toLocaleDateString("fr-CA")}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Valeur actuelle</p>
                            <p className="font-semibold text-neutral-100">{formatMoney(property.currentValue * property.quantity)}</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Hypothèque restante</p>
                            <p className="font-semibold text-red-400">{formatMoney(property.remainingBalance * property.quantity)}</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Équité</p>
                            <p className="font-semibold text-indigo-400">{formatMoney(equity)}</p>
                            <p className="text-xs text-neutral-500">{equityPercent.toFixed(1)}%</p>
                          </div>
                          <div className="bg-neutral-800/50 rounded p-3">
                            <p className="text-neutral-400">Paiement mensuel</p>
                            <p className="font-semibold text-amber-400">{formatMoney(property.monthlyPayment * property.quantity)}</p>
                          </div>
                        </div>

                        <div className="bg-emerald-900/20 border border-emerald-700/30 rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-neutral-300">Cashflow mensuel</span>
                            <span className={`font-bold ${property.monthlyCashflow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {formatMoney(property.monthlyCashflow * property.quantity)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-neutral-400">
                            <span>Loyer: {formatMoney(property.monthlyRent * property.quantity)}</span>
                            <span>Dépenses: {formatMoney((property.monthlyPayment + property.monthlyExpenses) * property.quantity)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setRefinanceProperty(property)}
                            className="flex-1 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                          >
                            Refinancer
                          </button>
                          <button 
                            onClick={() => setSellProperty(property)}
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
                href="/immobilier/recherche"
                className="inline-block px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                + Ajouter une propriété
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {refinanceProperty && (
        <RefinanceModal
          property={refinanceProperty}
          onClose={() => setRefinanceProperty(null)}
          onConfirm={handleRefinance}
        />
      )}

      {sellProperty && (
        <SellModal
          property={sellProperty}
          onClose={() => setSellProperty(null)}
          onConfirm={handleSell}
        />
      )}
    </main>
  );
}
