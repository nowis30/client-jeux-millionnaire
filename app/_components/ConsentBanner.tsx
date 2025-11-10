"use client";
import { useEffect, useState } from "react";
import { initializeAds } from "../../lib/ads";

/**
 * Bandeau de consentement RGPD pour les publicités
 * Affiche un bandeau en bas de l'écran si l'utilisateur n'a pas encore donné son consentement
 * Sauvegarde le choix dans localStorage
 */
export default function ConsentBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si le consentement a déjà été donné
    try {
      const consent = localStorage.getItem("hm-ad-consent");
      if (!consent) {
        setShow(true);
      }
    } catch {}
    setLoading(false);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("hm-ad-consent", "accepted");
      localStorage.setItem("hm-ad-consent-date", new Date().toISOString());
    } catch {}
    setShow(false);

    // Initialiser les publicités immédiatement après consentement
    // (sur web/no native, la fonction est un no-op)
    initializeAds().catch((err: unknown) => {
      console.error("[ConsentBanner] initializeAds failed after accept:", err);
    });
  };

  const handleRefuse = () => {
    try {
      localStorage.setItem("hm-ad-consent", "refused");
      localStorage.setItem("hm-ad-consent-date", new Date().toISOString());
    } catch {}
    setShow(false);
  };

  if (loading || !show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-700 p-4 shadow-lg z-50 md:bottom-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm text-neutral-300">
            <p className="font-medium mb-1">Cookies et publicités</p>
            <p className="text-xs text-neutral-400">
              Nous utilisons des cookies et affichons des publicités pour améliorer votre expérience. 
              En acceptant, vous consentez à l'utilisation de cookies publicitaires.{" "}
              <a href="/confidentialite/" className="text-emerald-400 hover:underline">
                Politique de confidentialité
              </a>
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleRefuse}
              className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-300"
            >
              Refuser
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm text-white font-medium"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
