"use client";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DRAG_WEB_URL, canLaunchNativeDrag, launchNativeDrag } from "../../lib/drag";

type NavItem = { href: string; label: string; external?: boolean };

const items: NavItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/immobilier", label: "Immobilier" },
  { href: "/bourse", label: "Bourse" },
  { href: "/portefeuille", label: "Portefeuille" },
  { href: "/quiz", label: "Quiz" },
  { href: "/pari", label: "Pari" },
  { href: "/login", label: "Connexion" },
  { href: DRAG_WEB_URL, label: "Drag", external: true },
];

const BUILD_TAG = "MNAV-DEBUG-20251120-1";
const SHOW_BADGE = false; // afficher le badge rouge de version
const SHOW_SWIPE_DEBUG = false; // afficher dx/dy et barre de progression

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enableSwipe, setEnableSwipe] = useState(true);
  const [isNative, setIsNative] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const cap: any = (window as any).Capacitor;
      const p = cap?.getPlatform ? cap.getPlatform() : cap?.platform;
      return p === "android" || p === "ios" || !!cap?.isNative || !!cap?.isNativePlatform;
    } catch { return false; }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cap: any = (window as any).Capacitor;
      const p = cap?.getPlatform ? cap.getPlatform() : cap?.platform;
      const native = p === "android" || p === "ios" || !!cap?.isNative || !!cap?.isNativePlatform;
      if (native !== isNative) setIsNative(!!native);
    } catch {}
  }, [isNative]);

  const openExternal = useCallback(async (url: string) => {
    if (typeof window === "undefined") return;
    const anyWin = window as any;
    try {
      const browser = anyWin?.Capacitor?.Plugins?.Browser;
      if (browser?.open) { await browser.open({ url }); return; }
    } catch {}
    try {
      const app = anyWin?.Capacitor?.Plugins?.App;
      if (app?.openUrl) { await app.openUrl({ url }); return; }
    } catch {}
    try { window.open(url, "_blank", "noopener,noreferrer"); }
    catch { window.location.href = url; }
  }, []);

  const handleNavigate = useCallback(async (item: NavItem) => {
    setOpen(false);
    const doNavigate = async () => {
      const target = item.href === "/" ? "/" : item.href.replace(/\/$/, "");
      const current = pathname === "/" ? "/" : (pathname || "").replace(/\/$/, "");
      if (!item.external && target === current) return;
      if (item.href === DRAG_WEB_URL) {
        const launched = canLaunchNativeDrag() ? await launchNativeDrag() : false;
        if (!launched) {
          if (typeof window !== "undefined") {
            try { window.location.assign(DRAG_WEB_URL); return; } catch {}
          }
          await router.push(DRAG_WEB_URL);
        }
        return;
      }
      if (item.external) { void openExternal(item.href); return; }
      await router.push(item.href);
    };
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => { void doNavigate(); });
    } else { await doNavigate(); }
  }, [pathname, router, openExternal]);

  useEffect(() => { setEnableSwipe(!open); }, [open]);

  useEffect(() => {
    console.log(`[MobileNav] mount version ${BUILD_TAG}`);
  }, []);

  return (
    <div className="md:hidden">
      {/* Badge version (désactivé par défaut) */}
      {SHOW_BADGE && (
        <div className="fixed top-0 left-0 z-[200] bg-red-600 text-white text-[10px] px-2 py-1 rounded-br shadow pointer-events-none">
          {BUILD_TAG}
        </div>
      )}
      {enableSwipe && (
        <>
          <SwipeHandle edge="left" onLeft={() => {}} onRight={() => { void navigatePrev(pathname, router); }} isNative={isNative} />
          <SwipeHandle edge="right" onLeft={() => { void navigateNext(pathname, router); }} onRight={() => {}} isNative={isNative} />
        </>
      )}

      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className={[
          "fixed z-40 rounded-full bg-neutral-900 border border-neutral-800 shadow-xl text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform",
          isNative ? "top-3 right-3 w-12 h-12" : "bottom-20 right-4 w-16 h-16",
        ].join(" ")}
      >
        <span className={isNative ? "block w-7 h-[3px] bg-white rounded" : "block w-8 h-[3px] bg-white rounded"} />
        <span className={isNative ? "block w-7 h-[3px] bg-white rounded" : "block w-8 h-[3px] bg-white rounded"} />
        <span className={isNative ? "block w-7 h-[3px] bg-white rounded" : "block w-8 h-[3px] bg-white rounded"} />
        {!isNative && <span className="text-[10px] font-medium tracking-wide">Menu</span>}
      </button>

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
          </nav>
        </div>
      )}

      {!open && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900/95 border-t border-neutral-800 flex justify-around py-2 px-1">
          {items.map((item) => {
            const normalized = item.href === "/" ? "/" : item.href.replace(/\/$/, "");
            const active = !item.external && (pathname === normalized || pathname?.startsWith(`${normalized}/`));
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => { void handleNavigate(item); }}
                className={[
                  "flex-1 mx-1 flex flex-col items-center justify-center rounded-md text-[11px] font-medium h-12 transition-colors",
                  active ? "bg-neutral-800 text-white" : "text-neutral-300 hover:bg-neutral-800/60"
                ].join(" ")}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function SwipeHandle({ edge, onLeft, onRight, isNative }: { edge: 'left' | 'right'; onLeft: () => void; onRight: () => void; isNative: boolean }) {
  const debugRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const threshold = 24; // px pour déclencher
  const maxBar = 80; // px largeur max de la barre de progression

  const updateDebug = (dx: number, dy: number) => {
    if (!SHOW_SWIPE_DEBUG) return;
    if (debugRef.current) {
      debugRef.current.textContent = `${edge}: dx:${Math.round(dx)} dy:${Math.round(dy)}`;
    }
    if (progressRef.current) {
      const w = Math.max(0, Math.min(maxBar, dx));
      progressRef.current.style.width = `${w}px`;
      progressRef.current.style.opacity = dx > 2 ? "1" : "0.3";
    }
  };

  const baseStyle: any = { width: 64, touchAction: "none", pointerEvents: "auto" };
  if (edge === 'left') { baseStyle.left = 8; } else { baseStyle.right = 8; }

  return (
    <div
      aria-hidden
      className="fixed top-0 h-screen z-[100]"
      style={baseStyle}
      onTouchStart={(e) => {
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        startRef.current = { x: t.clientX, y: t.clientY };
        updateDebug(0, 0);
      }}
      onTouchMove={(e) => {
        const st = startRef.current; if (!st) return;
        const t = e.touches && e.touches[0]; if (!t) return;
        const dx = t.clientX - st.x; const dy = Math.abs(t.clientY - st.y);
        updateDebug(dx, dy);
        if (dy > 60) return;
        if (edge === 'left' && dx > threshold) { onRight(); startRef.current = null; }
        if (edge === 'right' && dx < -threshold) { onLeft(); startRef.current = null; }
      }}
      onPointerDown={(e) => {
        startRef.current = { x: e.clientX, y: e.clientY };
        updateDebug(0, 0);
      }}
      onPointerMove={(e) => {
        const st = startRef.current; if (!st) return;
        const dx = e.clientX - st.x; const dy = Math.abs(e.clientY - st.y);
        updateDebug(dx, dy);
        if (dy > 60) return;
        if (edge === 'left' && dx > threshold) { onRight(); startRef.current = null; }
        if (edge === 'right' && dx < -threshold) { onLeft(); startRef.current = null; }
      }}
    >
      {SHOW_SWIPE_DEBUG && (
        <>
          <div ref={debugRef} className="absolute top-2 left-2 text-[10px] text-white/70 select-none">{edge}: dx:0 dy:0</div>
          <div className="absolute top-5 left-2 h-[3px] bg-white/30 rounded-full overflow-hidden" style={{ width: maxBar }}>
            <div ref={progressRef} className="h-full bg-white/80" style={{ width: 0, opacity: 0.3 }} />
          </div>
        </>
      )}
    </div>
  );
}

function normalizePath(p?: string | null) {
  if (!p) return '/';
  return p === '/' ? '/' : p.replace(/\/$/, '');
}

function getSequence() {
  return items.filter(i => !i.external);
}

async function navigateNext(pathname: string | null, router: ReturnType<typeof useRouter>) {
  const seq = getSequence();
  const current = normalizePath(pathname);
  let idx = seq.findIndex(i => {
    const n = normalizePath(i.href);
    return current === n || current.startsWith(`${n}/`);
  });
  if (idx < 0) idx = 0;
  const next = seq[(idx + 1) % seq.length];
  await router.push(next.href);
}

async function navigatePrev(pathname: string | null, router: ReturnType<typeof useRouter>) {
  const seq = getSequence();
  const current = normalizePath(pathname);
  let idx = seq.findIndex(i => {
    const n = normalizePath(i.href);
    return current === n || current.startsWith(`${n}/`);
  });
  if (idx < 0) idx = 0;
  const prev = seq[(idx - 1 + seq.length) % seq.length];
  await router.push(prev.href);
}
