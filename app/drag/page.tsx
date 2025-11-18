"use client";

import type { Metadata } from "next";
import DragIframeWrapper from "./_components/DragIframeWrapper";
import NativeDragLauncher from "./_components/NativeDragLauncher";
import { useState } from "react";

// Page interne: intègre le mini‑jeu via iframe pour éviter redirections.
// Les assets sont servis depuis /drag/iframe.html (public/drag/iframe.html)
// Sur Android natif, l'iframe est masquée et la version native est lancée automatiquement
export default function DragPage() {
  const [isNative, setIsNative] = useState(false);

  return (
    <main className="w-full h-[calc(100vh-4rem)] flex flex-col">
      {!isNative && (
        <div className="p-2 text-xs text-neutral-400">
          <p>
            Mini‑jeu intégré. Si l'affichage ne se charge pas, essayez la version plein écran ou rafraîchissez.
          </p>
          <p>
            Les gains et meilleurs temps seront synchronisés avec votre session Millionnaire (implémentation prochaine).
          </p>
        </div>
      )}

      <NativeDragLauncher onNativeDetected={setIsNative} />

      {!isNative && (
        <div className="flex-1 border-t border-neutral-800">
          <DragIframeWrapper />
        </div>
      )}

      {isNative && (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">
          <p>🏁 Version native Android - Appuyez sur le bouton pour lancer une course</p>
        </div>
      )}
    </main>
  );
}
