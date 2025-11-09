/**
 * Système de publicités AdMob
 * Utilise le plugin natif AdMob pour Android via Capacitor
 * Sur le web, les fonctions ne font rien (no-op)
 */

// Type pour Capacitor (disponible seulement dans l'app native)
interface CapacitorType {
  isNativePlatform: () => boolean;
}

// Type pour le plugin AdMob
interface AdMobPlugin {
  initialize(): Promise<void>;
  loadInterstitial(): Promise<void>;
  showInterstitial(): Promise<void>;
  isAdReady(): Promise<{ ready: boolean }>;
}

let Capacitor: CapacitorType | null = null;
let AdMob: AdMobPlugin | null = null;
let isInitialized = false;
let isAdLoaded = false;
let lastAdShown = 0;
const MIN_AD_INTERVAL = 120000; // 2 minutes entre chaque pub

/**
 * Vérifier si on est sur une plateforme native
 */
function isNativePlatform(): boolean {
  return Capacitor?.isNativePlatform() ?? false;
}

/**
 * Initialiser AdMob (à appeler au démarrage de l'app)
 */
export async function initializeAds(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Essayer d'importer Capacitor (disponible seulement dans l'app native)
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      Capacitor = (window as any).Capacitor;
      
      if (!isNativePlatform()) {
        return;
      }

      // Importer le plugin AdMob depuis le contexte global (injecté par l'app native)
      if ((window as any).AdMob) {
        AdMob = (window as any).AdMob;
        
        if (AdMob) {
          await AdMob.initialize();
          isInitialized = true;
          
          // Précharger la première annonce
          await loadInterstitialAd();
          
          console.log('[Ads] AdMob initialized successfully');
        }
      }
    }
  } catch (error) {
    console.error('[Ads] Failed to initialize AdMob:', error);
  }
}

/**
 * Charger une annonce interstitielle
 */
async function loadInterstitialAd(): Promise<void> {
  if (!AdMob || !isInitialized) {
    return;
  }

  try {
    await AdMob.loadInterstitial();
    isAdLoaded = true;
    console.log('[Ads] Interstitial ad loaded');
  } catch (error) {
    console.error('[Ads] Failed to load interstitial ad:', error);
    isAdLoaded = false;
  }
}

/**
 * Afficher une annonce interstitielle
 * @returns true si l'annonce a été affichée, false sinon
 */
export async function showInterstitialAd(): Promise<boolean> {
  if (!isNativePlatform() || !AdMob || !isInitialized) {
    console.log('[Ads] Not on native platform or AdMob not initialized');
    return false;
  }

  // Vérifier l'intervalle minimum entre les pubs
  const now = Date.now();
  if (now - lastAdShown < MIN_AD_INTERVAL) {
    console.log('[Ads] Too soon to show another ad');
    return false;
  }

  try {
    // Vérifier si une annonce est prête
    const { ready } = await AdMob.isAdReady();
    if (!ready) {
      console.log('[Ads] No ad ready to show');
      // Essayer de charger une nouvelle annonce pour la prochaine fois
      loadInterstitialAd();
      return false;
    }

    // Afficher l'annonce
    await AdMob.showInterstitial();
    lastAdShown = now;
    isAdLoaded = false;
    
    // Précharger la prochaine annonce
    loadInterstitialAd();
    
    console.log('[Ads] Interstitial ad shown successfully');
    return true;
  } catch (error) {
    console.error('[Ads] Failed to show interstitial ad:', error);
    return false;
  }
}

/**
 * Fonction deprecated (vidéos récompensées)
 * Gardée pour compatibilité, retourne toujours false
 * @deprecated Utilisez showInterstitialAd() à la place
 */
export async function showRewardedAd(_adUnitId?: string): Promise<boolean> {
  console.log('[Ads] showRewardedAd is deprecated, use showInterstitialAd instead');
  return showInterstitialAd();
}

/**
 * Vérifier si une annonce est prête à être affichée
 */
export async function isAdReady(): Promise<boolean> {
  if (!isNativePlatform() || !AdMob || !isInitialized) {
    return false;
  }

  try {
    const { ready } = await AdMob.isAdReady();
    return ready;
  } catch (error) {
    return false;
  }
}

/**
 * Fonction deprecated
 * @deprecated Non utilisée avec le nouveau système AdMob
 */
export function getAdUnit(_idFromEnv?: string): string | undefined {
  return undefined;
}


