"use client";

import { useEffect } from 'react';
import { initializeAds } from '../../lib/ads';

/**
 * Composant pour initialiser les publicités AdMob au démarrage de l'app
 * Fonctionne uniquement sur les plateformes natives (Android via Capacitor)
 */
export default function AdInitializer() {
  useEffect(() => {
    // Initialiser AdMob quand le composant monte
    initializeAds().catch((err: unknown) => {
      console.error('[AdInitializer] Failed to initialize ads:', err);
    });
  }, []);

  // Ce composant ne rend rien
  return null;
}
