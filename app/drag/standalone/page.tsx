"use client";

import { useEffect, useRef } from "react";

export const dynamic = "force-static";

// Version plein écran autonome du mini‑jeu.
export default function DragStandalonePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      // Attendre que main.js soit complètement chargé
      setTimeout(() => {
        const token = localStorage.getItem("HM_TOKEN");
        if (token && iframe.contentWindow) {
          console.log("[DragStandalone] Envoi du token à l'iframe");
          iframe.contentWindow.postMessage(
            { type: "AUTH_TOKEN", token, source: "parent" },
            window.location.origin
          );
        } else {
          console.warn("[DragStandalone] Pas de token trouvé");
        }
      }, 100);
    };

    iframe.addEventListener("load", handleIframeLoad);
    return () => iframe.removeEventListener("load", handleIframeLoad);
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        ref={iframeRef}
        title="Drag Shift Duel Fullscreen"
        src="/drag/iframe.html"
        className="w-full h-full"
        allow="fullscreen"
      />
    </div>
  );
}
