"use client";
import { useState } from "react";

type Step = { title: string; content: string };

export default function OnboardingHome({ onClose, storageKey = "hm-tutorial-home" }: { onClose: () => void; storageKey?: string }) {
  // Tutoriel enrichi (fusion des anciennes sections de la page /tutoriel)
  const steps: Step[] = [
    {
      title: "Objectif Global",
      content:
        "Fais croître ta valeur nette en combinant 4 moteurs: Immobilier (cashflow & appréciation), Bourse (diversification & dividendes), Quiz (accélérateur de capital), Pari (risque contrôlé). Garde toujours un coussin de liquidités pour saisir les opportunités et éviter de bloquer ton jeu.",
    },
    {
      title: "Immobilier — Achat & Stocks",
      content:
        "Dans ‘Immobilier’, choisis un bien (ex: six‑plex, tour 50, tour 100). Vérifie loyer, taux et charges. Les boutons ‘refill’ et ‘+10’ maintiennent l’offre (6‑plex→10, tours50→10, tours100→5). Diversifie entre flux de loyers et valeur pour refinancements futurs.",
    },
    {
      title: "Bourse — Positions & Dividendes",
      content:
        "Dans ‘Bourse’, sélectionne un symbole (SP500, TSX, QQQ, TLT, GLD). Les dividendes tombent périodiquement et renforcent ton cash. Mélange actifs cycliques (croissance) et défensifs (obligations/or) pour lisser la volatilité immobilière.",
    },
    {
      title: "Quiz — Session de 10 Questions",
      content:
        "Consomme 1 token pour lancer: Q1-2 faciles, Q3-5 moyennes, Q6-10 difficiles. Chaque bonne réponse double ta somme de session (5k→10k→20k...). Tu peux encaisser à tout moment avant une erreur. Catégories variées (anatomy, finance, général). Optimise en sécurisant après une bonne série.",
    },
    {
      title: "Pari — 3 Dés à Risque",
      content:
        "Mise (≥5 000$) puis lance 3 dés: double = x2, triple ou suite = x3, sinon perte de la mise. Ne sur‑expose pas ton capital avant un achat immobilier clé. Le volet Pari est un accélérateur ponctuel, pas un moteur principal durable.",
    },
    {
      title: "Stratégies Rapides",
      content:
        "Démarrage: 1–2 six‑plex + quiz pour booster le cash. Milieu: entrée en bourse, viser tour 50 pour masse critique. Fin: grandes structures + quiz difficile avec encaissement prudent. Toujours anticiper pénurie: utiliser refill avant manque de stock.",
    },
    {
      title: "Dépannage & Vérifications",
      content:
        "Problème quiz? Vérifie: tokens >0, endpoint /api/games/<id>/quiz/status = 200 (console réseau). Proxy /api/* corrige CORS. Besoin d’aide: lien contact dans la page ‘Contact’. Garde tes logs propres avant de reporter un bug.",
    },
    {
      title: "Invitations Bonus",
      content:
        "Utilise ‘Inviter un ami’ sur l’accueil: quand validé tu reçois 1 000 000$. Profite-en pour créer un mini réseau et comparer vos stratégies de portefeuille.",
    },
  ];

  const [i, setI] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  function close() {
    try { if (dontShow) localStorage.setItem(storageKey, "1"); } catch {}
    onClose();
  }
  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-2xl text-gray-900">
        <div className="p-6">
          <div className="text-xl font-bold mb-2">{steps[i].title}</div>
          <div className="text-sm text-gray-700 mb-6">{steps[i].content}</div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2 select-none">
              <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
              Ne plus afficher automatiquement
            </label>
            <div className="flex gap-2">
              {i > 0 && (
                <button className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setI((x) => Math.max(0, x - 1))}>← Précédent</button>
              )}
              {i < steps.length - 1 ? (
                <button className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))}>Suivant →</button>
              ) : (
                <button className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700" onClick={close}>C’est parti</button>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 pb-4 text-center">
          <div className="inline-flex gap-1">
            {steps.map((_, idx) => (
              <span key={idx} className={`h-2 w-2 rounded-full ${idx === i ? "bg-indigo-600" : "bg-gray-300"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
