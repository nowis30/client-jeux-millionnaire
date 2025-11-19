"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { DRAG_WEB_URL } from "../../lib/drag";
import { isCapacitor, openImmobilier } from "../../lib/mobile";

type NavItem = { href: string; label: string; external?: boolean };

// Navigation mobile compacte avec bouton flottant et tiroir de liens
const items: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/immobilier", label: "Immobilier" },
  { href: "/bourse", label: "Bourse" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: DRAG_WEB_URL, label: "Drag" },
  { href: "/quiz", label: "Quiz" },
  { href: "/pari", label: "Pari" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const openExternal = useCallback(async (url: string) => {
    if (typeof window === "undefined") return;
    const anyWin = window as any;
    try {
      const browser = anyWin?.Capacitor?.Plugins?.Browser;
      if (browser?.open) {
        await browser.open({ url });
        return;
      }
    } catch {}
    try {
      const app = anyWin?.Capacitor?.Plugins?.App;
      if (app?.openUrl) {
        await app.openUrl({ url });
        return;
      }
    } catch {}
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = url;
    }
  }, []);
  const handleNavigate = useCallback(async (item: NavItem) => {
    setOpen(false);
    // Ouvrir natif pour Immobilier si Capacitor dispo
    if (item.href === "/immobilier" && isCapacitor()) {
      // Aligner avec l'accueil: ouvrir la page "/immobilier" (pas le hub "/immobilier/menu")
      const opened = await openImmobilier("https://client-jeux-millionnaire.vercel.app/immobilier");
      if (opened) return;
      // fallback navigation web si le plugin n'est pas disponible
    }
    if (item.external) {
      void openExternal(item.href);
      return;
    }
    router.push(item.href);
  }, [router, openExternal]);
  // Masqué sur desktop
  return (
    <div className="md:hidden">
      {/* Bouton menu principal agrandi */}
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="fixed z-40 bottom-20 right-4 w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 shadow-xl text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
      >
        <span className="block w-8 h-[3px] bg-white rounded" />
        <span className="block w-8 h-[3px] bg-white rounded" />
        <span className="block w-8 h-[3px] bg-white rounded" />
        <span className="text-[10px] font-medium tracking-wide">Menu</span>
      </button>

      {/* Boutons persistants Quiz & Pari */}
      <div className="fixed z-40 bottom-4 right-4 flex gap-3">
        <Link
          href="/quiz"
          className={[
            "relative group flex flex-col items-center justify-center w-16 h-16 rounded-xl shadow-lg border",
            pathname?.startsWith("/quiz")
              ? "bg-sky-600 border-sky-500 text-white"
              : "bg-sky-700 border-sky-600 text-white hover:bg-sky-600",
          ].join(" ")}
          prefetch={false}
        >
          <span className="text-sm font-semibold">Quiz</span>
          <span className="absolute -top-2 -right-2 bg-white text-sky-700 text-[10px] px-1.5 py-0.5 rounded-full shadow group-hover:scale-110 transition-transform">★</span>
        </Link>
        <Link
          href="/pari"
          className={[
            "flex flex-col items-center justify-center w-16 h-16 rounded-xl shadow-lg border",
            pathname?.startsWith("/pari")
              ? "bg-amber-600 border-amber-500 text-white"
              : "bg-amber-700 border-amber-600 text-white hover:bg-amber-600",
          ].join(" ")}
          prefetch={false}
        >
          <span className="text-sm font-semibold">Pari</span>
        </Link>
      </div>

      {/* Tiroir plein écran */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setOpen(false)}>
          <nav
            className="absolute inset-x-0 bottom-0 bg-neutral-900 border-t border-neutral-800 rounded-t-2xl p-5 pt-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold tracking-wide text-neutral-300">Navigation</div>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 text-sm hover:bg-neutral-700"
              >
                Fermer
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-[15px]">
              {items.map((item) => {
                const normalized = item.href === "/" ? "/" : item.href.replace(/\/$/, "");
                const active = !item.external && (pathname === normalized || pathname?.startsWith(`${normalized}/`));
                return (
                  <li key={item.href}>
                    <button
                      type="button"
                      onClick={() => { void handleNavigate(item); }}
                      className={[
                        "block w-full rounded-lg px-4 py-3 border font-medium",
                        active
                          ? "bg-neutral-800 border-neutral-700 text-white"
                          : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/70",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Aide / raccourcis dans tiroir */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleNavigate({ href: "/quiz", label: "Quiz" })}
                className={[
                  "block w-full text-center rounded-lg px-4 py-3 font-semibold shadow",
                  pathname?.startsWith("/quiz")
                    ? "bg-sky-600 text-white"
                    : "bg-sky-700 text-white hover:bg-sky-600",
                ].join(" ")}
              >
                Démarrer Quiz
              </button>
              <button
                type="button"
                onClick={() => handleNavigate({ href: "/pari", label: "Pari" })}
                className={[
                  "block w-full text-center rounded-lg px-4 py-3 font-semibold shadow",
                  pathname?.startsWith("/pari")
                    ? "bg-amber-600 text-white"
                    : "bg-amber-700 text-white hover:bg-amber-600",
                ].join(" ")}
              >
                Lancer Pari
              </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
