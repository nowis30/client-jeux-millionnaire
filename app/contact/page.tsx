"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ContactPage() {
  const [playerId, setPlayerId] = useState<string>("");
  useEffect(() => {
    try {
      const s = localStorage.getItem("hm-session");
      if (s) {
        const obj = JSON.parse(s);
        if (obj?.playerId) setPlayerId(String(obj.playerId));
      }
    } catch {}
  }, []);
  const dynamicMailHref = `mailto:smorin_23@hotmail.com?subject=${encodeURIComponent("Support Héritier Millionnaire")}&body=${encodeURIComponent("Bonjour\n\n(Décrivez votre problème ou suggestion ici)\n\nID joueur: " + (playerId || "(inconnu)"))}`;
  return (
    <main className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Contact & Support</h2>
      <p className="text-neutral-300 text-sm leading-relaxed">
        Si vous rencontrez des <strong>troubles</strong>, bugs, difficultés d'accessibilité ou que vous avez une
        <strong> suggestion</strong> pour améliorer le jeu, vous pouvez me joindre directement par courriel.
      </p>
      <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 space-y-3">
        <h3 className="font-semibold text-rose-200">Support direct</h3>
        <p className="text-sm text-rose-100/90">
          Cliquez sur le bouton ci-dessous pour ouvrir votre client courriel avec un modèle pré‑rempli.
        </p>
        <a
          href={dynamicMailHref}
          className="inline-block px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium"
        >
          ✉️ Contacter le support
        </a>
      </div>
      <section className="space-y-3">
        <h4 className="font-semibold text-lg">Conseils avant d'écrire</h4>
        <ul className="list-disc pl-5 text-sm text-neutral-300 space-y-1">
          <li>Indiquez votre ID joueur (visible sur votre badge en haut à droite).</li>
          <li>Précisez la page où le problème survient (ex: Quiz, Immobilier, Bourse).</li>
          <li>Ajoutez le message d'erreur exact s'il y en a un (copier/coller ou capture).</li>
          <li>Notez l'heure approximative et votre navigateur (Chrome, Firefox, Mobile…).</li>
          <li>Pour une suggestion: expliquez le bénéfice pour les joueurs.</li>
        </ul>
      </section>
      <section className="space-y-3">
        <h4 className="font-semibold text-lg">Alternatives</h4>
        <p className="text-sm text-neutral-300">
          Consultez aussi le <Link href="/tutoriel" className="text-indigo-300 hover:text-indigo-200 underline">Tutoriel</Link> et les
          sections dépannage pour des solutions rapides.
        </p>
      </section>
      <p className="text-xs text-neutral-500">Dernière mise à jour: 8 novembre 2025</p>
    </main>
  );
}
