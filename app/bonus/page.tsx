'use client';

import { watchVerifiedReward } from "../../lib/reward-verification";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { isRewardedAdReady, getRewardedAdCooldown } from '../../lib/ads';
import { loadSession } from '../../lib/session';
import { apiFetch } from '../../lib/api';
import { formatMoney } from '../../lib/format';

export default function BonusPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState(1_000_000);

  // Debug : Vérifier Capacitor
  useEffect(() => {
    const checkCapacitor = () => {
      const win = window as any;
      const hasCapacitor = !!win.Capacitor;
      const isNative = win.Capacitor?.isNativePlatform?.() || false;
      const hasAdMob = !!win.Capacitor?.Plugins?.AdMob;
      
      const info = `Capacitor: ${hasCapacitor} | Native: ${isNative} | AdMob: ${hasAdMob}`;
      setDebugInfo(info);
      console.log('[Bonus Debug]', info);
      console.log('[Bonus Debug] Full Capacitor:', win.Capacitor);
    };
    
    checkCapacitor();
    setTimeout(checkCapacitor, 2000); // Revérifier après 2 secondes
  }, []);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setGameId(session.gameId || null);
      setPlayerId(session.playerId || null);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!gameId || !playerId) return;
    try {
      const data = await apiFetch<{ available: boolean; secondsUntilAvailable: number; rewardAmount: number }>(`/api/games/${gameId}/bonus/status`);
      setServerAvailable(Boolean(data.available));
      setCooldown(Math.max(0, Number(data.secondsUntilAvailable ?? 0)));
      if (typeof data.rewardAmount === "number" && !Number.isNaN(data.rewardAmount)) {
        setRewardAmount(data.rewardAmount);
      }
      setError(null);
    } catch (err: any) {
      if (err?.status === 404) return;
      const message = err?.message || "Impossible de récupérer la disponibilité du bonus.";
      setError(message);
    }
  }, [gameId, playerId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Vérifier si une pub est disponible
  useEffect(() => {
    const checkAdReady = async () => {
      const ready = await isRewardedAdReady();
      setAdReady(ready);

      const remainingCooldown = getRewardedAdCooldown();
      if (remainingCooldown > 0) {
        setCooldown(remainingCooldown);
      }
    };

    checkAdReady();

    const interval = setInterval(checkAdReady, 5000);

    return () => clearInterval(interval);
  }, []);

  // Mettre à jour le cooldown chaque seconde
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => {
        setCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleWatchAd = async () => {
    if (!gameId || !playerId) {
      setError("Rejoignez la partie mondiale pour débloquer ce bonus.");
      return;
    }
    if (isLoading || cooldown > 0 || !serverAvailable || !adReady) return;

    setIsLoading(true);
    setError(null);
    setReward(null);

    try {
      const rewardIntentId = await watchVerifiedReward(gameId, 'bonus');

      if (!rewardIntentId) {
        setError("La pub n'a pas pu être affichée. Réessayez dans quelques instants.");
        return;
      }

      const response = await apiFetch<{ rewardAmount?: number; secondsUntilNext?: number }>(`/api/games/${gameId}/bonus/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardIntentId }),
      });

      const awarded = Number(response?.rewardAmount ?? rewardAmount);
      setReward(awarded);
      setRewardAmount(awarded);

      const serverCooldown = Number(response?.secondsUntilNext ?? 0);
      const pluginCooldown = getRewardedAdCooldown();
      setCooldown(Math.max(serverCooldown, pluginCooldown));
      setServerAvailable(false);
      setAdReady(false);
      refreshStatus();
    } catch (err: any) {
      if (err?.status === 429) {
        refreshStatus();
      }
      console.error('Erreur lors de l\'affichage de la pub:', err);
      setError(err?.message || "Une erreur s'est produite");
    } finally {
      setIsLoading(false);
    }
  };

  // Formater le temps restant
  const formatCooldown = (seconds: number): string => {
    if (seconds === 0) return '';
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }
    return `${secs}s`;
  };

  const isDisabled = !gameId || !playerId || isLoading || cooldown > 0 || !serverAvailable || !adReady;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link 
            href="/"
            className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour
          </Link>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">💰 Bonus Gratuit</h1>
          <p className="text-xl text-white/80">
            Regardez une pub et gagnez {formatMoney(rewardAmount)} !
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          {/* Reward Display */}
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full px-8 py-4 mb-4">
              <div className="text-sm text-white/90 uppercase tracking-wider mb-1">Récompense</div>
              <div className="text-5xl font-bold text-white">
                {formatMoney(rewardAmount)}
              </div>
            </div>
            <p className="text-white/70 text-sm">
              Regardez une publicité de 30 secondes pour recevoir cette récompense
            </p>
          </div>

          {/* Success Message */}
          {reward && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-lg font-semibold">
                Félicitations ! Vous avez gagné ${reward.toLocaleString()} !
              </div>
              <div className="text-sm text-white/70 mt-2">
                L'argent a été ajouté à votre compte
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-center">
              <div className="text-sm">{error}</div>
            </div>
          )}

          {/* Watch Ad Button */}
          <button
            onClick={handleWatchAd}
            disabled={isDisabled}
            className={`
              w-full py-4 px-6 rounded-xl font-bold text-xl
              transition-all duration-200 shadow-lg
              ${isDisabled 
                ? 'bg-gray-500 cursor-not-allowed opacity-60' 
                : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 active:scale-95'
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Chargement de la publicité...
              </span>
            ) : !gameId || !playerId ? (
              <span>Connexion en cours...</span>
            ) : cooldown > 0 ? (
              <span>⏱️ Disponible dans {formatCooldown(cooldown)}</span>
            ) : !serverAvailable ? (
              <span>🔄 Bonus en préparation...</span>
            ) : !adReady ? (
              <span>📺 Chargement de la pub...</span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="text-2xl">📺</span>
                <span>Regarder la publicité</span>
              </span>
            )}
          </button>

          {/* Info */}
          <div className="mt-6 space-y-3 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Regardez la publicité en entier pour recevoir la récompense</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Vous pouvez gagner un bonus toutes les 5 minutes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>L'argent est immédiatement crédité sur votre compte</span>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center text-sm text-white/50">
          <p>Les publicités nous aident à maintenir le jeu gratuit pour tous</p>
          <p className="mt-2">Merci de votre soutien ! 💜</p>
          
          {/* Debug Info */}
          {debugInfo && (
            <div className="mt-4 p-2 bg-black/30 rounded text-xs font-mono text-left">
              {debugInfo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
