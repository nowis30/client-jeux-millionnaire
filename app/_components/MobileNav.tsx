"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Navigation mobile compacte avec bouton flottant et tiroir de liens
const items = [
  { href: "/", label: "Accueil" },
  { href: "/immobilier", label: "Immobilier" },
  { href: "/bourse", label: "Bourse" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/quiz", label: "Quiz" },
  { href: "/pari", label: "Pari" },
  { href: "/tutoriel", label: "Tutoriel" },
  { href: "/telecharger", label: "Télécharger" },
  { href: "/contact", label: "Contact" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Masquer sur desktop
  return (
    <div className="md:hidden">
      {/* Bouton flottant */}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-4 right-4 rounded-full bg-neutral-900 border border-neutral-800 shadow-lg px-4 py-3 text-white flex items-center gap-2"
      >
        <span className="inline-block w-5 h-[2px] bg-white" />
        <span className="sr-only">Menu</span>
      </button>

      {/* Tiroir plein écran */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setOpen(false)}>
          <nav
            className="absolute inset-x-0 bottom-0 bg-neutral-900 border-t border-neutral-800 rounded-t-xl p-4 pt-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-neutral-400">Navigation</div>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm"
              >
                Fermer
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-[14px]">
              {items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={[
                        "block w-full rounded-md px-3 py-2 border",
                        active
                          ? "bg-neutral-800 border-neutral-700 text-white"
                          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/70",
                      ].join(" ")}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>

            {/* Raccourcis action rapides */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href="/quiz"
                onClick={() => setOpen(false)}
                className={[
                  "block w-full text-center rounded-md px-3 py-2",
                  pathname?.startsWith("/quiz")
                    ? "bg-sky-600 text-white"
                    : "bg-sky-700 text-white hover:bg-sky-600",
                ].join(" ")}
              >
                Quiz
              </a>
              <a
                href="/pari"
                onClick={() => setOpen(false)}
                className={[
                  "block w-full text-center rounded-md px-3 py-2",
                  pathname?.startsWith("/pari")
                    ? "bg-amber-600 text-white"
                    : "bg-amber-700 text-white hover:bg-amber-600",
                ].join(" ")}
              >
                Pari
              </a>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
