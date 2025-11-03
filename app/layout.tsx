import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import dynamic from "next/dynamic";
const UserBadge = dynamic(() => import("./_components/UserBadge"), { ssr: false });
export const metadata: Metadata = {
  title: "Héritier Millionnaire",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen max-w-6xl mx-auto p-6">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Héritier Millionnaire</h1>
            <div className="flex items-center gap-4">
              <nav className="space-x-4">
                <a href="/">Dashboard</a>
                <a href="/immobilier">Immobilier</a>
                <a href="/bourse">Bourse</a>
                <a href="/listings">Annonces</a>
                <a href="/summary">Résumé</a>
              </nav>
              <UserBadge />
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
