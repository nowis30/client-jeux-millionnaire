"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function UserBadge() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ id: string; email: string; isAdmin: boolean }>("/api/auth/me");
        setEmail(me.email);
        setIsAdmin(!!me.isAdmin);
      } catch {}
    })();
  }, []);

  // Ne rien afficher sur les pages d'auth (évite tout affichage de profil sur /login, /forgot, /reset)
  if (pathname === "/login" || pathname === "/forgot" || pathname === "/reset") {
    return null;
  }
  return (
    <div className="text-sm text-neutral-300 flex items-center gap-2">
      {email ? (
        <>
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium" title={email}>{email}</span>
          {isAdmin && <span className="px-2 py-0.5 text-xs rounded bg-amber-600/30 border border-amber-600/60">Admin</span>}
        </>
      ) : (
        <>
          <span className="inline-flex h-2 w-2 rounded-full bg-neutral-500" />
          <a href="/login" className="underline">Se connecter</a>
        </>
      )}
    </div>
  );
}
