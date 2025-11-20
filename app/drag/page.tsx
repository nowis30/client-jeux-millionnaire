"use client";

import type { Metadata } from "next";
import NativeDragLauncher from "./_components/NativeDragLauncher";
import { useEffect, useState } from "react";
import { canLaunchNativeDrag, launchNativeDrag } from "../../lib/drag";
export const dynamic = "force-static";

// Page interne: intègre le mini‑jeu via iframe pour éviter redirections.
// Les assets sont servis depuis /drag/iframe.html (public/drag/iframe.html)
// Sur Android natif, l'iframe est masquée et la version native est lancée automatiquement
export default function DragPage() {
  const [isNative, setIsNative] = useState(false);

  // Auto‑launch du jeu natif si disponible (retour à l'expérience qui "allait bien")
  useEffect(() => {
    let t: any;
    if (canLaunchNativeDrag()) {
      t = setTimeout(() => { void launchNativeDrag(); }, 200);
    }
    return () => { if (t) clearTimeout(t); };
  }, []);

  return (
    <main className="w-full h-[calc(100vh-4rem)] flex flex-col">
      <NativeDragLauncher onNativeDetected={setIsNative} />

      {!isNative && (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
          <p>Chargement de la version native… Si rien ne se passe, appuyez sur le bouton ci‑dessus.</p>
        </div>
      )}
    </main>
  );
}
