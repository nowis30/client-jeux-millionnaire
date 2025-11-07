"use client";
import { useState } from "react";

type Step = { title: string; content: string };

export default function OnboardingHome({ onClose, storageKey = "hm-tutorial-home" }: { onClose: () => void; storageKey?: string }) {
  const steps: Step[] = [
    { title: "Bienvenue !", content: "Objectif: faire croître ta valeur nette en investissant (immobilier, bourse), en jouant au quiz et en gérant bien ton risque." },
    { title: "Acheter un immeuble", content: "Va dans ‘Immobilier’, choisis une propriété, vérifie le loyer, les charges et le taux. Clique ‘Acheter’." },
    { title: "Acheter en bourse", content: "Va dans ‘Bourse’, sélectionne un symbole (ex: SP500/QQQ), entre la quantité et confirme l’achat." },
    { title: "Vendre un immeuble", content: "Va dans ‘Annonces’, publie un bien ou vends ton bien existant. Le cash revient après la vente." },
    { title: "Volet Pari (dés)", content: "Dans ‘Pari’ tu mises (min 5 000$) et lances 3 dés: double = x2, triple ou suite = x3, sinon tu perds la mise. NE RISQUE PAS TOUT: la chance tourne toujours ! Mise raisonnable = survie long terme." },
    { title: "Inviter et gagner 1 000 000$", content: "Depuis la page d’accueil, ‘Inviter un ami’ → génère ton lien. Quand l’invitation est acceptée, tu reçois 1 000 000$." },
    { title: "Astuce", content: "Diversifie tes placements, surveille les taux hypothécaires, utilise le quiz pour booster ton cash, et garde une réserve: le hasard du volet Pari peut autant aider que punir." },
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
