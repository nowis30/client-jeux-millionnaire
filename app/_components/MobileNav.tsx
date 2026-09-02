"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DRAG_WEB_URL, canLaunchNativeDrag, launchNativeDrag } from "../../lib/drag";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  external?: boolean;
};

const primaryItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: "⌂" },
  { href: "/immobilier", label: "Immo", icon: "🏘" },
  { href: "/bourse", label: "Bourse", icon: "↗" },
  { href: "/quiz", label: "Quiz", icon: "?" },
];

const secondaryItems: NavItem[] = [
  { href: "/portefeuille", label: "Portefeuille", icon: "💼" },
  { href: "/pari", label: "Pari", icon: "🎯" },
  { href: DRAG_WEB_URL, label: "Drag Racing", icon: "🏁", external: true },
  { href: "/login", label: "Compte / Connexion", icon: "👤" },
];

function normalizePath(path?: string | null) {
  if (!path) return "/";
  return path === "/" ? "/" : path.replace(/\/$/, "");
}

function isPathActive(pathname: string | null, href: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isImmersiveRoute = Boolean(
    pathname?.startsWith("/drag") || pathname?.startsWith("/quiz")
  );
  const secondaryActive = useMemo(
    () => secondaryItems.some((item) => !item.external && isPathActive(pathname, item.href)),
    [pathname]
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [moreOpen]);

  const navigate = useCallback(
    async (item: NavItem) => {
      setMoreOpen(false);

      if (item.href === DRAG_WEB_URL) {
        const launched = canLaunchNativeDrag() ? await launchNativeDrag() : false;
        if (!launched) {
          if (typeof window !== "undefined") {
            window.location.assign(DRAG_WEB_URL);
            return;
          }
          await router.push(DRAG_WEB_URL);
        }
        return;
      }

      if (item.external) {
        if (typeof window !== "undefined") window.location.assign(item.href);
        return;
      }

      if (!isPathActive(pathname, item.href)) {
        await router.push(item.href);
      }
    },
    [pathname, router]
  );

  // Le Quiz et le Drag ont leurs propres contrôles plein écran.
  if (isImmersiveRoute) return null;

  return (
    <div className="md:hidden">
      {moreOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
          role="presentation"
        >
          <section
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t border-white/10 bg-[#11151f]/98 px-4 pt-3 shadow-2xl"
            style={{ paddingBottom: "calc(92px + env(safe-area-inset-bottom))" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Plus d'options"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Navigation</p>
                <h2 className="text-lg font-black text-white">Plus d'options</h2>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="ui-touch grid place-items-center rounded-full border border-white/10 bg-white/5 text-xl text-slate-200"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {secondaryItems.map((item) => {
                const active = !item.external && isPathActive(pathname, item.href);
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => void navigate(item)}
                    className={[
                      "min-h-[76px] rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98]",
                      active
                        ? "border-cyan-300/50 bg-cyan-300/15 text-white"
                        : "border-white/10 bg-white/[0.045] text-slate-200",
                    ].join(" ")}
                  >
                    <span className="mb-1 block text-2xl" aria-hidden>{item.icon}</span>
                    <span className="block text-sm font-bold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        className="mobile-tabbar fixed inset-x-0 bottom-0 z-[100] border-t border-white/10 bg-[#0b0f18]/95 px-2 pt-2 backdrop-blur-xl"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const active = isPathActive(pathname, item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => void navigate(item)}
                aria-current={active ? "page" : undefined}
                className={[
                  "relative flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-1 text-[10px] font-bold transition active:scale-95",
                  active ? "bg-cyan-300/15 text-cyan-200" : "text-slate-400",
                ].join(" ")}
              >
                <span
                  className={[
                    "mb-0.5 grid h-7 min-w-7 place-items-center rounded-xl text-[20px] leading-none",
                    active ? "text-cyan-200" : "text-slate-300",
                  ].join(" ")}
                  aria-hidden
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {active && <span className="absolute bottom-0.5 h-1 w-4 rounded-full bg-cyan-300" />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={[
              "relative flex min-h-[54px] flex-col items-center justify-center rounded-2xl px-1 text-[10px] font-bold transition active:scale-95",
              secondaryActive || moreOpen ? "bg-cyan-300/15 text-cyan-200" : "text-slate-400",
            ].join(" ")}
          >
            <span className="mb-0.5 grid h-7 min-w-7 place-items-center rounded-xl text-xl font-black leading-none text-slate-300" aria-hidden>•••</span>
            <span>Plus</span>
            {(secondaryActive || moreOpen) && <span className="absolute bottom-0.5 h-1 w-4 rounded-full bg-cyan-300" />}
          </button>
        </div>
      </nav>
    </div>
  );
}
