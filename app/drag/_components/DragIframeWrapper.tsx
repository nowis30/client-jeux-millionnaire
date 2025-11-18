"use client";

import { useEffect, useRef } from "react";

/**
 * Wrapper client-side pour l'iframe drag qui gère le transfert du token d'authentification
 * depuis le parent (Next.js) vers l'iframe via postMessage.
 */
export default function DragIframeWrapper() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      // Attendre un petit délai pour que le script main.js soit complètement chargé
      setTimeout(() => {
        // Récupérer le token d'authentification du localStorage parent
        const token = localStorage.getItem("HM_TOKEN");
        
        if (token && iframe.contentWindow) {
          console.log("[DragIframeWrapper] Envoi du token à l'iframe:", token.substring(0, 20) + "...");
          
          // Envoyer le token à l'iframe via postMessage
          iframe.contentWindow.postMessage(
            {
              type: "AUTH_TOKEN",
              token: token,
              source: "parent"
            },
            window.location.origin // Sécurisé : même origine uniquement
          );
        } else {
          console.warn("[DragIframeWrapper] Pas de token HM_TOKEN trouvé dans localStorage");
        }
      }, 100); // Délai de 100ms pour s'assurer que main.js est chargé
    };

    // Écouter le chargement de l'iframe
    iframe.addEventListener("load", handleIframeLoad);

    return () => {
      iframe.removeEventListener("load", handleIframeLoad);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      title="Drag Shift Duel"
      src="/drag/iframe.html"
      className="w-full h-full bg-black"
      allow="fullscreen"
    />
  );
}
