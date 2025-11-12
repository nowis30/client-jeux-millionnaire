"use client";
import { useCallback, useEffect, useState } from "react";
import { initializeAds } from "../../lib/ads";

export default function ConfidentialitePage() {
  const [consent, setConsent] = useState<string | null>(null);
  const [consentDate, setConsentDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setConsent(localStorage.getItem("hm-ad-consent"));
      setConsentDate(localStorage.getItem("hm-ad-consent-date"));
    } catch {}
  }, []);

  const refreshFromStorage = useCallback(() => {
    try {
      setConsent(localStorage.getItem("hm-ad-consent"));
      setConsentDate(localStorage.getItem("hm-ad-consent-date"));
    } catch {}
  }, []);

  const setAndInit = useCallback(async (value: string | null) => {
    setBusy(true);
    try {
      if (value) {
        localStorage.setItem("hm-ad-consent", value);
        localStorage.setItem("hm-ad-consent-date", new Date().toISOString());
      } else {
        localStorage.removeItem("hm-ad-consent");
        localStorage.removeItem("hm-ad-consent-date");
      }
      refreshFromStorage();
      await initializeAds();
    } catch (e) {
      console.error("[Confidentialite] setAndInit error:", e);
    } finally {
      setBusy(false);
    }
  }, [refreshFromStorage]);

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Politique de confidentialité</h1>
        <p className="text-sm text-neutral-300">Dernière mise à jour : 9 novembre 2025</p>
      </section>
      <section className="space-y-3 text-sm text-neutral-300">
        <p>
          Cette application collecte des données minimales nécessaires au fonctionnement du jeu (identifiants anonymes, état de la partie, scores) et aux services associés (authentification, sécurité, prévention de la fraude).
        </p>
        <p>
          Des publicités peuvent être affichées via Google AdMob. Des identifiants publicitaires peuvent être utilisés pour mesurer la performance des annonces et éviter la fraude. Selon votre région, un bandeau de consentement peut vous être affiché pour choisir vos préférences.
        </p>
        <p>
          Nous ne vendons pas vos données. Vos informations ne sont partagées qu’avec des prestataires techniques strictement nécessaires (hébergement, base de données, emailing, mesures d’audience).
        </p>
        <p>
          Vous pouvez demander la suppression de votre compte et des données associées en nous contactant à l’adresse&nbsp;:
          <a href="mailto:support@nowis.store" className="text-emerald-400 hover:underline">support@nowis.store</a>.
        </p>
        <p>
          Pour toute question concernant cette politique ou l’utilisation de vos données, contactez-nous à la même adresse.
        </p>
      </section>

      {/* Gestion des préférences publicitaires */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Préférences publicitaires</h2>
        <div className="text-sm text-neutral-300">
          <p>
            État actuel : {consent ? (
              <span className="font-medium">{consent}</span>
            ) : (
              <span className="italic">non défini</span>
            )}
            {consentDate && (
              <span className="ml-2 text-neutral-500">({new Date(consentDate).toLocaleString()})</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setAndInit("accepted")}
            disabled={busy}
            className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-60"
          >
            Accepter les pubs personnalisées
          </button>
          <button
            onClick={() => setAndInit("npa")}
            disabled={busy}
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-60"
          >
            Pubs non personnalisées (NPA)
          </button>
          <button
            onClick={() => setAndInit(null)}
            disabled={busy}
            className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-white text-sm disabled:opacity-60"
            title="Réinitialise la préférence et relance la demande de consentement sur appareil"
          >
            Réinitialiser la préférence
          </button>
        </div>
        <p className="text-xs text-neutral-400">
          Remarque : si vous choisissez « Refuser » dans le bandeau, l’application affichera des publicités non personnalisées.
        </p>
      </section>
    </main>
  );
}
