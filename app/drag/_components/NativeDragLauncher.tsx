"use client";

import { useEffect, useState } from "react";

interface NativeDragLauncherProps {
  onNativeDetected?: (isNative: boolean) => void;
}

export default function NativeDragLauncher({ onNativeDetected }: NativeDragLauncherProps) {
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [autoLaunched, setAutoLaunched] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cap: any = (window as any).Capacitor;
    const platform = cap?.getPlatform ? cap.getPlatform() : cap?.platform;
    const hasPlugin = !!cap?.Plugins?.DragLauncher;
    const isNativePlatform = platform === "android" || platform === "ios" || !!cap?.isNative || !!cap?.isNativePlatform;
    // Condition: on considère l’environnement natif seulement si plugin présent ET plateforme native
    const available = hasPlugin && isNativePlatform;
    setNativeAvailable(available);
    if (onNativeDetected) onNativeDetected(available);

    // Ne plus auto-lancer: éviter sortie immédiate de la WebView et permettre choix de l’utilisateur.
    // (Si l’on veut réactiver l’auto‑launch plus tard, remettre le bloc setTimeout(openNative, 300)).
  }, [onNativeDetected]);

  const getAuthPayload = () => {
    if (typeof window === "undefined") return undefined;
    try {
      const token =
        window.localStorage.getItem("HM_TOKEN") ||
        window.localStorage.getItem("hm-token") ||
        undefined;
      const sessionJson = window.localStorage.getItem("hm-session") || undefined;
      if (!token && !sessionJson) return undefined;
      return { token, sessionJson };
    } catch {
      return undefined;
    }
  };

  const openNative = async () => {
    try {
      const cap: any = (window as any).Capacitor;
      const plugin: any = cap?.Plugins?.DragLauncher;
      if (!plugin) return;
      const payload = getAuthPayload() || {};
      // Préférer 'open' pour rester dans l’activité native et garder le jeu affiché.
      if (typeof plugin.open === "function") {
        await plugin.open(payload);
      } else if (typeof plugin.race === "function") {
        await plugin.race(payload);
      }
    } catch (e) {
      console.warn("DragLauncher natif indisponible:", e);
    }
  };

  if (!nativeAvailable) return null;

  return (
    <div className="px-2 pb-2">
      <button
        onClick={openNative}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm py-2 rounded"
      >
        🏁 Ouvrir le mini‑jeu natif
      </button>
      <p className="mt-2 text-[11px] text-neutral-400">
        Mode natif: persiste dans l’activité Android. Le bouton reste disponible si vous fermez le jeu.
      </p>
    </div>
  );
}
