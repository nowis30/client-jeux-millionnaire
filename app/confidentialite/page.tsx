"use client";

export default function ConfidentialitePage() {
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
    </main>
  );
}
