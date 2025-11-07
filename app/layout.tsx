import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
const UserBadge = dynamic(() => import("./_components/UserBadge"), { ssr: false });
const MobileNav = dynamic(() => import("./_components/MobileNav"), { ssr: false });
const PresenceClient = dynamic(() => import("./_components/PresenceClient"), { ssr: false });
export const metadata: Metadata = {
  title: "Héritier Millionnaire",
  manifest: "/manifest.webmanifest",
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
        <div className="min-h-screen mx-auto px-4 md:px-6 pb-20 md:pb-6 max-w-none md:max-w-6xl overflow-x-hidden">
          <header className="mb-4 md:mb-6 flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-bold">Héritier Millionnaire</h1>
            <div className="flex items-center gap-3 md:gap-4">
              <nav className="hidden md:block space-x-4">
                <a href="/">Dashboard</a>
                <a href="/immobilier">Immobilier</a>
                <a href="/bourse">Bourse</a>
                <a href="/listings">Annonces</a>
                <a href="/summary">Résumé</a>
                <a href="/pari">Pari</a>
              </nav>
              <UserBadge />
            </div>
          </header>
          {/* Socket de présence global (toutes pages) */}
          <PresenceClient />
          {children}
        </div>
        {/* Barre de navigation mobile fixe */}
        <MobileNav />
      </body>
    </html>
  );
}
