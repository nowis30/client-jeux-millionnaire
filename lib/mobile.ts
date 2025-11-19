"use client";

/**
 * Helpers mobiles (Capacitor) pour ouvrir des vues natives depuis le web.
 */
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const anyWin = window as any;
  const cap = anyWin?.Capacitor || anyWin?.capacitor || anyWin?.CAPACITOR;
  const platform = cap?.getPlatform?.() || cap?.platform;
  return !!cap && (platform === "android" || platform === "ios" || platform === "webview");
}

/**
 * Tente d'ouvrir l'activité Immobilier native via le plugin Capacitor.
 * @param startUrl URL initiale à charger (optionnel)
 * @returns true si l'ouverture native a réussi, sinon false
 */
export async function openImmobilier(startUrl?: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const anyWin = window as any;
  const cap = anyWin?.Capacitor || anyWin?.capacitor || anyWin?.CAPACITOR;
  const plugins = cap?.Plugins || cap?.plugins || cap?.pluginsRef;
  const launcher = plugins?.ImmobilierLauncher || plugins?.immobilierLauncher;
  try {
    if (launcher?.open) {
      await launcher.open(startUrl ? { startUrl } : {});
      return true;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("openImmobilier: échec d'ouverture native", e);
  }
  return false;
}
