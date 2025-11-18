"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// Redirection vers le menu Immobilier ou vers la section hypothèques si un immeuble est sélectionné
export default function ImmobilierRedirect() {
  const searchParams = useSearchParams();
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const selectedId = searchParams.get("select");
    
    // Si un immeuble est sélectionné, rediriger vers la section hypothèques
    if (selectedId) {
      setRedirectUrl(`/immobilier/hypotheques?select=${selectedId}`);
      window.location.href = `/immobilier/hypotheques?select=${selectedId}`;
    } else {
      setRedirectUrl("/immobilier/menu");
      window.location.href = "/immobilier/menu";
    }
  }, [searchParams]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-neutral-400">Redirection vers le menu immobilier...</p>
      {redirectUrl && (
        <Link href={redirectUrl} className="text-emerald-400 underline">
          Cliquez ici si la redirection ne fonctionne pas
        </Link>
      )}
    </div>
  );
}

