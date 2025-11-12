import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Drag Shift Duel | Héritier Millionnaire",
  description: "Affrontez l'IA en ligne droite, synchronisez vos shifts et cumulez des gains partagés avec le jeu principal.",
};

export default function DragPage() {
  return (
    <main className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Drag Shift Duel</h2>
        <p className="text-sm md:text-base text-neutral-300">
          Cette version intégrée du mini-jeu se connecte à la même session Millionnaire&nbsp;: vos courses mises à jour
          créditent immédiatement la banque et la progression «&nbsp;Drag&nbsp;». Pour de meilleures performances, utilisez un
          écran large ou faites pivoter le téléphone en paysage.
        </p>
        <div className="flex flex-wrap gap-2 text-xs md:text-sm text-neutral-300">
          <span className="px-3 py-1 rounded-full border border-emerald-600/50 bg-emerald-900/30">
            Maintiens la pédale (flèche haut ou bouton)
          </span>
          <span className="px-3 py-1 rounded-full border border-sky-600/50 bg-sky-900/30">Nitro (N, X ou bouton)</span>
          <span className="px-3 py-1 rounded-full border border-purple-600/50 bg-purple-900/30">
            Shift parfait dans la zone verte
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Jouer maintenant</h3>
          <a
            href="/jeu-drag.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-xs md:text-sm hover:bg-neutral-800"
          >
            Ouvrir dans une nouvelle fenêtre
          </a>
        </div>
        <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-xl">
          <div className="aspect-video">
            <iframe
              title="Drag Shift Duel"
              src="/jeu-drag.html"
              className="h-full w-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section className="space-y-2 text-sm text-neutral-300">
        <h3 className="text-lg font-semibold text-white">Astuces rapides</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>Une série de quatre shifts parfaits force la victoire et sécurise la prime complète.</li>
          <li>Le garage permet de régler les rapports et le nitro; clique sur «&nbsp;Appliquer&nbsp;» avant la course.</li>
          <li>Sur mobile natif (APK), le plugin réseau Capacitor évite les blocages CORS automatiquement.</li>
          <li>En dev local, lance le proxy <code>local-cors-proxy</code> sur 8010 ou définis <code>window.DRAG_API_BASE</code>.</li>
        </ul>
        <p className="text-xs text-neutral-500">
          Besoin d&apos;un refresh des gains ou d&apos;un test rapide ? Tu peux aussi relancer le dashboard principal via
          <Link href="/" className="ml-1 underline">l&apos;accueil</Link>.
        </p>
      </section>
    </main>
  );
}
