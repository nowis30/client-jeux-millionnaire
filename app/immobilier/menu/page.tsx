"use client";
import Link from "next/link";
import { Search, DollarSign, Building2 } from "lucide-react";

export default function ImmobilierMenuPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-neutral-100">🏢 Immobilier</h1>
          <p className="text-neutral-400 text-lg">Choisissez votre espace de travail</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Carte 1 - Recherche & Analyse */}
          <Link href="/immobilier/recherche" className="group">
            <div className="h-full p-8 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/50 border-2 border-emerald-700/30 hover:border-emerald-500/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                  <Search className="w-12 h-12 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-100">Recherche & Analyse</h2>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  Explorez les immeubles disponibles, analysez leur rentabilité, calculez les revenus et dépenses
                </p>
                <div className="pt-2 text-emerald-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Ouvrir →
                </div>
              </div>
            </div>
          </Link>

          {/* Carte 2 - Hypothèques & Financement */}
          <Link href="/immobilier/hypotheques" className="group">
            <div className="h-full p-8 rounded-2xl bg-gradient-to-br from-indigo-900/30 to-indigo-950/50 border-2 border-indigo-700/30 hover:border-indigo-500/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors">
                  <DollarSign className="w-12 h-12 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-100">Hypothèques & Financement</h2>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  Calculez vos paiements mensuels, simulez différents taux, optimisez votre mise de fonds
                </p>
                <div className="pt-2 text-indigo-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Ouvrir →
                </div>
              </div>
            </div>
          </Link>

          {/* Carte 3 - Parc Immobilier */}
          <Link href="/immobilier/parc" className="group">
            <div className="h-full p-8 rounded-2xl bg-gradient-to-br from-amber-900/30 to-amber-950/50 border-2 border-amber-700/30 hover:border-amber-500/60 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/20">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-amber-500/20 group-hover:bg-amber-500/30 transition-colors">
                  <Building2 className="w-12 h-12 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-neutral-100">Parc Immobilier</h2>
                <p className="text-neutral-300 text-sm leading-relaxed">
                  Gérez votre portfolio, visualisez vos cashflows, réhypothéquez et vendez vos biens
                </p>
                <div className="pt-2 text-amber-400 font-semibold group-hover:translate-x-1 transition-transform">
                  Ouvrir →
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="text-center pt-4">
          <Link href="/" className="text-neutral-400 hover:text-neutral-200 transition-colors text-sm">
            ← Retour au menu principal
          </Link>
        </div>
      </div>
    </main>
  );
}
