"use client";

import NativeDragLauncher from "./_components/NativeDragLauncher";
import DragIframeWrapper from "./_components/DragIframeWrapper";
import { useEffect, useState } from "react";
import { canLaunchNativeDrag, launchNativeDrag } from "../../lib/drag";
export const dynamic = "force-static";

// Page interne: intègre le mini‑jeu via iframe pour éviter redirections.
// Les assets sont servis par la route /drag/iframe depuis public/drag/iframe.html.
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
        <div className="min-h-0 flex-1">
          <DragIframeWrapper />
        </div>
      )}
    </main>
  );
}
