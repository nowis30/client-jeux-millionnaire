import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Script from "next/script";
import dynamic from "next/dynamic";
import { DRAG_WEB_URL } from "../lib/drag";
const MountGate = dynamic(() => import("./_components/MountGate"), { ssr: false });
const UserBadge = dynamic(() => import("./_components/UserBadge"), { ssr: false });
const MobileNav = dynamic(() => import("./_components/MobileNav"), { ssr: false });
const PresenceClient = dynamic(() => import("./_components/PresenceClient"), { ssr: false });
const AdInitializer = dynamic(() => import("./_components/AdInitializer"), { ssr: false });
const BackgroundMusic = dynamic(() => import("./_components/BackgroundMusic"), { ssr: false });
const ConsentBanner = dynamic(() => import("./_components/ConsentBanner"), { ssr: false });
const KeepAliveClient = dynamic(() => import("./_components/KeepAliveClient"), { ssr: false });
export const metadata: Metadata = {
  title: "Héritier Millionnaire",
  description: "Simulez immobilier, bourse, quiz de culture financière et devenez l'héritier millionnaire.",
  manifest: "/manifest.webmanifest",
  keywords: ["immobilier", "bourse", "quiz", "finance", "jeu", "investissement"],
  openGraph: {
    title: "Héritier Millionnaire",
    description: "Construisez votre patrimoine via immobilier, marchés et quiz de culture financière.",
    url: "https://www.nowis.store",
    siteName: "Héritier Millionnaire",
    type: "website",
    locale: "fr_FR"
  },
  twitter: {
    card: "summary_large_image",
    title: "Héritier Millionnaire",
    description: "Immobilier · Bourse · Quiz · Devenez #1 du classement.",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="overflow-x-hidden">
      <body className="overflow-x-hidden">
        <Script id="platform-flag" strategy="beforeInteractive">
          {`
            (function(){
              try {
                var cap = window.Capacitor || {};
                var p = typeof cap.getPlatform === 'function' ? cap.getPlatform() : cap.platform;
                var native = (p === 'android' || p === 'ios' || !!cap.isNative || !!cap.isNativePlatform);
                var docEl = document.documentElement;
                if (native) { docEl.classList.add('native'); }
                else { docEl.classList.add('web'); }
              } catch (e) { /* no-op */ }
            })();
          `}
        </Script>
        {/* Overlay d'erreurs runtime (native debugging) */}
        <Script id="runtime-error-overlay" strategy="afterInteractive">
          {`
            (function(){
              var overlayId = 'native-error-overlay';
              function ensure(){
                var el = document.getElementById(overlayId);
                if(!el){
                  el = document.createElement('div');
                  el.id = overlayId;
                  el.style.position='fixed';
                  el.style.bottom='8px';
                  el.style.left='8px';
                  el.style.zIndex='99999';
                  el.style.maxWidth='90%';
                  el.style.fontFamily='monospace';
                  el.style.fontSize='11px';
                  el.style.padding='6px 8px';
                  el.style.borderRadius='6px';
                  el.style.background='rgba(180,0,0,0.85)';
                  el.style.color='#fff';
                  el.style.boxShadow='0 0 0 1px #700,0 2px 6px rgba(0,0,0,0.5)';
                  el.style.pointerEvents='none';
                  el.style.whiteSpace='pre-wrap';
                  el.style.display='none';
                  document.body.appendChild(el);
                }
                return el;
              }
              function show(msg){
                var el=ensure();
                el.textContent=msg.slice(0,800);
                el.style.display='block';
              }
              window.addEventListener('error', function(ev){
                try { show('[ERROR] '+ (ev?.error?.message || ev.message || 'unknown')); } catch {}
              });
              window.addEventListener('unhandledrejection', function(ev){
                try { show('[REJECTION] '+ (ev?.reason?.message || ev?.reason || 'unknown')); } catch {}
              });
            })();
          `}
        </Script>
        {/* JSON-LD Organisation / Application */}
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Héritier Millionnaire',
            url: 'https://www.nowis.store',
            description: 'Jeu de simulation finance et immobilier avec quiz.',
            sameAs: [
              'https://www.nowis.store'
            ]
          }) }}
        />
        <div className="min-h-screen mx-auto px-4 md:px-6 pt-0 pb-20 md:pt-0 md:pb-6 max-w-none md:max-w-6xl overflow-x-hidden">
          {/* Barre de navigation desktop uniquement en haut */}
          <div className="hidden md:flex items-center justify-end py-4">
            <div className="flex items-center gap-3 md:gap-4">
              <nav className="space-x-4">
                <Link href="/" prefetch={false}>Dashboard</Link>
                <Link href="/immobilier" prefetch={false}>Immobilier</Link>
                <Link href="/bourse" prefetch={false}>Bourse</Link>
                <Link href="/portefeuille" prefetch={false}>Portefeuille</Link>
                <Link href="/pari" prefetch={false}>Pari</Link>
                <Link href="/quiz" prefetch={false}>Quiz</Link>
                <Link href={DRAG_WEB_URL} prefetch={false}>Drag</Link>
              </nav>
              <UserBadge />
            </div>
          </div>
          {/* Badge utilisateur mobile en haut à droite */}
          <div className="md:hidden flex justify-end py-2">
            <UserBadge />
          </div>
          {/* Clients sensibles montés après hydration pour éviter erreurs d'ordre de hooks */}
          <MountGate>
            {/* Socket de présence global (toutes pages) */}
            <PresenceClient />
            {/* Initialisation AdMob pour app Android */}
            <AdInitializer />
            {/* Musique de fond (lecture après première interaction utilisateur) */}
            <BackgroundMusic />
            {/* Bandeau de consentement RGPD */}
            <ConsentBanner />
            {/* Keep-alive Render pour limiter le cold start apparent */}
            <KeepAliveClient />
          </MountGate>
          {/* Suppression de l'écran d'attente: on arrive directement sur l'accueil */}
          {children}
        </div>
        {/* Navigation mobile (montée immédiatement pour activer le swipe) */}
        <MobileNav />
      </body>
    </html>
  );
}
