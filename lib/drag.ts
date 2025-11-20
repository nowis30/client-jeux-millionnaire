// Route web historique (legacy) du mini‑jeu drag.
// Conservée uniquement pour compatibilité / fallback dans l'iframe.
export const DRAG_WEB_URL = "/drag";

// Détection du plugin natif (Android / iOS via Capacitor)
export function getNativeDragPlugin(): any | undefined {
	if (typeof window === "undefined") return undefined;
	const cap: any = (window as any).Capacitor;
	return cap?.Plugins?.DragLauncher;
}

export function canLaunchNativeDrag(): boolean {
	if (typeof window === "undefined") return false;
	const cap: any = (window as any).Capacitor;
	const platform = cap?.getPlatform ? cap.getPlatform() : cap?.platform;
	const isNativePlatform = platform === "android" || platform === "ios" || !!cap?.isNative || !!cap?.isNativePlatform;
	return !!getNativeDragPlugin() && isNativePlatform;
}

function collectAuthPayload(): any | undefined {
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
}

// Lance l'activité native. Préfère plugin.open (activité persistante) sinon plugin.race.
export async function launchNativeDrag(): Promise<boolean> {
	const plugin = getNativeDragPlugin();
	if (!plugin) return false;
	try {
		const payload = collectAuthPayload() || {};
		if (typeof plugin.open === "function") {
			await plugin.open(payload);
			return true;
		}
		if (typeof plugin.race === "function") {
			await plugin.race(payload);
			return true;
		}
	} catch (e) {
		// Échec silencieux: on renverra false pour autoriser fallback web si nécessaire
		console.warn("[drag] Échec lancement natif:", e);
	}
	return false;
}

