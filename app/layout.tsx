import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import dynamic from "next/dynamic";
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
        <div className="min-h-screen mx-auto px-4 md:px-6 pb-20 md:pb-6 max-w-none md:max-w-6xl overflow-x-hidden">
          <header className="mb-4 md:mb-6 flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">Héritier Millionnaire</h1>
            <div className="flex items-center gap-3 md:gap-4">
              <nav className="hidden md:block space-x-4">
                <Link href="/" prefetch={false}>Dashboard</Link>
                <Link href="/immobilier" prefetch={false}>Immobilier</Link>
                <Link href="/bourse" prefetch={false}>Bourse</Link>
                <Link href="/portefeuille" prefetch={false}>Portefeuille</Link>
                <Link href="/drag" prefetch={false}>Drag</Link>
                <Link href="/pari" prefetch={false}>Pari</Link>
                <Link href="/quiz" prefetch={false}>Quiz</Link>
                <Link href="/tutoriel" prefetch={false}>Tutoriel</Link>
                <Link href="/telecharger" prefetch={false}>Télécharger</Link>
                <Link href="/contact" prefetch={false} className="text-rose-300 hover:text-rose-200" title="Des difficultés ou suggestions ? Contactez le support">Contact</Link>
                <Link href="/confidentialite" prefetch={false} className="text-neutral-300 hover:text-neutral-100">Confidentialité</Link>
              </nav>
              <UserBadge />
            </div>
          </header>
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
        {/* Barre de navigation mobile fixe */}
        <MobileNav />
      </body>
    </html>
  );
}
