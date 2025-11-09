'use client';

import { useState, useEffect } from 'react';
import { showRewardedAdForReward, isRewardedAdReady, getRewardedAdCooldown } from '../lib/ads';

interface RewardedAdButtonProps {
  /** Montant de la récompense en $ */
  rewardAmount: number;
  /** Callback appelé quand l'utilisateur gagne la récompense */
  onRewardEarned?: (amount: number) => void;
  /** Classe CSS additionnelle */
  className?: string;
}

export default function RewardedAdButton({ 
  rewardAmount, 
  onRewardEarned,
  className = '' 
}: RewardedAdButtonProps) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Vérifier si une pub est disponible
  useEffect(() => {
    const checkAdReady = async () => {
      const ready = await isRewardedAdReady();
      setIsReady(ready);
      
      const remainingCooldown = getRewardedAdCooldown();
      setCooldown(remainingCooldown);
    };

    checkAdReady();
    
    // Vérifier toutes les 10 secondes
    const interval = setInterval(checkAdReady, 10000);
    
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

  const handleClick = async () => {
    if (!isReady || isLoading || cooldown > 0) return;

    setIsLoading(true);

    try {
      const success = await showRewardedAdForReward((amount: number, type: string) => {
        console.log(`Récompense gagnée: ${amount} ${type}`);
        
        // Appeler le callback avec le montant configuré
        if (onRewardEarned) {
          onRewardEarned(rewardAmount);
        }
      });

      if (success) {
        // Réinitialiser le cooldown
        setCooldown(getRewardedAdCooldown());
        setIsReady(false);
      }
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la pub:', error);
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
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const isDisabled = !isReady || isLoading || cooldown > 0;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        relative px-6 py-3 rounded-lg font-semibold text-white
        transition-all duration-200 shadow-lg
        ${isDisabled 
          ? 'bg-gray-400 cursor-not-allowed opacity-60' 
          : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:scale-105 active:scale-95'
        }
        ${className}
      `}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Chargement...
        </span>
      ) : cooldown > 0 ? (
        <span>Disponible dans {formatCooldown(cooldown)}</span>
      ) : !isReady ? (
        <span>📺 Pub en chargement...</span>
      ) : (
        <span className="flex items-center gap-2">
          <span>📺</span>
          <span>Regarder une pub</span>
          <span className="font-bold text-yellow-300">+${rewardAmount.toLocaleString()}</span>
        </span>
      )}
    </button>
  );
}
