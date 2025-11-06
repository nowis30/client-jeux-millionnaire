"use client";
import { useEffect, useState } from "react";

type Step = { title: string; content: string };

export default function Onboarding({
  onClose,
  storageKey = "hm-tutorial-quiz",
}: {
  onClose: () => void;
  storageKey?: string;
}) {
  const steps: Step[] = [
    {
      title: "Bienvenue dans Quitte ou Double",
      content:
        "Gagnez de l'argent en répondant à des questions. Vous recevez des tokens automatiquement chaque heure pour lancer une session.",
    },
    {
      title: "Démarrer une session",
      content:
        "Appuyez sur ‘Démarrer le Quiz’ (1 token). Une session contient jusqu'à 10 questions et commence à 5 000 $.",
    },
    {
      title: "Répondre et doubler",
      content:
        "Chaque bonne réponse double vos gains (5k → 10k → 20k …). Vous pouvez encaisser à tout moment.",
    },
    {
      title: "Sauter jusqu'à 3 questions",
      content:
        "Si une question s'entremêle ou ne vous inspire pas, utilisez ‘Passer’. Vous avez 3 sauts par session.",
    },
    {
      title: "Mauvaise réponse",
      content:
        "Une mauvaise réponse = vous perdez tout. L'app affiche la bonne réponse pendant 5 secondes, puis la session se termine.",
    },
    {
      title: "Conseils",
      content:
        "Variez les catégories, surveillez vos sauts restants, et encaissez si vous voulez sécuriser vos gains.",
    },
  ];

  const [i, setI] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  function close() {
    try {
      if (dontShow) localStorage.setItem(storageKey, "1");
    } catch {}
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl text-gray-900">
        <div className="p-6">
          <div className="text-xl font-bold mb-2">{steps[i].title}</div>
          <div className="text-sm text-gray-700 mb-6">{steps[i].content}</div>
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-600 flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => setDontShow(e.target.checked)}
              />
              Ne plus afficher automatiquement
            </label>
            <div className="flex gap-2">
              {i > 0 && (
                <button
                  className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  onClick={() => setI((x) => Math.max(0, x - 1))}
                >
                  ← Précédent
                </button>
              )}
              {i < steps.length - 1 ? (
                <button
                  className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))}
                >
                  Suivant →
                </button>
              ) : (
                <button
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
                  onClick={close}
                >
                  J'ai compris
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 pb-4 text-center">
          <div className="inline-flex gap-1">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 w-2 rounded-full ${idx === i ? "bg-indigo-600" : "bg-gray-300"}`}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
