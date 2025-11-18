"use client";
import { useState } from "react";

export default function MortgageExplanation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-xl border border-indigo-600/60 bg-indigo-900/20 p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-lg font-semibold text-indigo-200">
          💡 C'est quoi une hypothèque ? (pour les enfants)
        </h3>
        <span className="text-2xl text-indigo-300">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 text-sm text-neutral-200 animate-fade-in">
          {/* Section 1 : C'est quoi une hypothèque ? */}
          <div className="space-y-2">
            <h4 className="font-semibold text-indigo-300 text-base">C'est quoi une hypothèque ?</h4>
            <p className="leading-relaxed">
              Quand tu veux acheter un immeuble, tu n'as presque jamais tout l'argent tout de suite. 
              Tu donnes une partie de l'argent au début, par exemple <strong>20%</strong>. Cette partie-là 
              s'appelle la <strong className="text-emerald-300">mise de fonds</strong>.
            </p>
            <p className="leading-relaxed">
              Le reste de l'argent, la banque te le prête : c'est ça, l'<strong className="text-amber-300">hypothèque</strong>. 
              Tu dois ensuite rembourser l'hypothèque un peu chaque mois, avec des <strong>intérêts</strong> 
              (c'est l'argent que tu dois payer en plus à la banque pour te remercier de t'avoir prêté l'argent).
            </p>
          </div>

          {/* Section 2 : Pourquoi 20% ? */}
          <div className="space-y-2">
            <h4 className="font-semibold text-indigo-300 text-base">Pourquoi 20% ?</h4>
            <p className="leading-relaxed">
              Si tu mets 20% de mise de fonds, ça veut dire que tu paies une partie de l'immeuble avec ton argent, 
              et seulement <strong>80%</strong> est emprunté à la banque.
            </p>
            <p className="leading-relaxed">
              Plus ta mise de fonds est grande, moins tu as d'hypothèque à rembourser et 
              <strong className="text-emerald-300"> moins tu paies d'intérêts au total</strong>. 
              C'est pour ça que c'est bien d'économiser !
            </p>
          </div>

          {/* Section 3 : Exemple simple */}
          <div className="rounded bg-neutral-900/50 border border-neutral-700 p-3 space-y-2">
            <h4 className="font-semibold text-amber-300 text-base">📊 Exemple simple :</h4>
            <ul className="space-y-1 list-disc list-inside text-sm">
              <li>Prix de l'immeuble : <strong>100 000 $</strong></li>
              <li>Mise de fonds (20%) : <strong className="text-emerald-300">20 000 $</strong> 
                <span className="text-neutral-400"> (ton argent)</span>
              </li>
              <li>Hypothèque (80%) : <strong className="text-amber-300">80 000 $</strong> 
                <span className="text-neutral-400"> (prêt de la banque)</span>
              </li>
            </ul>
            <p className="text-xs text-neutral-400 mt-2">
              Chaque mois, tu rembourses un peu de l'hypothèque + les intérêts. Au bout de plusieurs années, 
              tu auras remboursé toute l'hypothèque et l'immeuble sera entièrement à toi !
            </p>
          </div>

          {/* Section 4 : Conseil */}
          <div className="bg-sky-900/30 border border-sky-700 rounded p-3">
            <p className="text-sm">
              <strong className="text-sky-300">💪 Conseil :</strong> Dans le jeu, commence avec des 
              petits immeubles (comme des 6-plex) pour apprendre. Puis, quand tu as plus d'argent, 
              achète des tours et des gratte-ciel !
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
