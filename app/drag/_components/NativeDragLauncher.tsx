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
    const hasPlugin = !!cap?.Plugins?.DragLauncher;
    const isNative = !!cap?.isNative || !!cap?.isNativePlatform;
    const available = hasPlugin || isNative;
    setNativeAvailable(available);

    // Notifier le parent si on est en natif
    if (onNativeDetected) {
      onNativeDetected(available);
    }

    // Auto-lancer la version native sur Android au premier chargement
    if (available && !autoLaunched) {
      setAutoLaunched(true);
      setTimeout(() => {
        openNative();
      }, 300); // Petit délai pour laisser le composant se monter proprement
    }
  }, [autoLaunched, onNativeDetected]);

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
      if (typeof plugin.race === "function") {
        await plugin.race(payload);
      } else if (typeof plugin.open === "function") {
        await plugin.open(payload);
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
        🏁 Lancer une course native (avec pub)
      </button>
    </div>
  );
}
