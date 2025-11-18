import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import dynamic from "next/dynamic";
import { DRAG_WEB_URL } from "../lib/drag";
const UserBadge = dynamic(() => import("./_components/UserBadge"), { ssr: false });
const MobileNav = dynamic(() => import("./_components/MobileNav"), { ssr: false });
const PresenceClient = dynamic(() => import("./_components/PresenceClient"), { ssr: false });
const AdInitializer = dynamic(() => import("./_components/AdInitializer"), { ssr: false });
const BackgroundMusic = dynamic(() => import("./_components/BackgroundMusic"), { ssr: false });
const ConsentBanner = dynamic(() => import("./_components/ConsentBanner"), { ssr: false });
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
          {/* Socket de présence global (toutes pages) */}
          <PresenceClient />
          {/* Initialisation AdMob pour app Android */}
          <AdInitializer />
          {/* Musique de fond (lecture après première interaction utilisateur) */}
          <BackgroundMusic />
          {/* Bandeau de consentement RGPD */}
          <ConsentBanner />
          {children}
        </div>
        {/* Barre de navigation mobile fixe en bas */}
        <MobileNav />
      </body>
    </html>
  );
}
