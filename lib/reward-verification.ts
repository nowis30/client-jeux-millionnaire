import { useSyncExternalStore } from 'react';
import { apiFetch } from './api';
import { showRewardedAdForReward, supportsRewardVerification } from './ads';
import { completeRewardIntent, requestVerifiedReward, rewardStorageKey, type RewardKind, type RewardContext } from './reward-verification-core';

const CHANGED_EVENT = 'hm-pending-reward-changed';
function readPending(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writePending(key: string, value: string | null): void {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(CHANGED_EVENT));
  } catch {}
}
function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function usePendingReward(gameId: string | null, kind: RewardKind, context: RewardContext = {}): boolean {
  const key = gameId ? rewardStorageKey(gameId, kind, context) : null;
  return useSyncExternalStore(subscribe, () => Boolean(key && readPending(key)), () => false);
}

export function finishReward(gameId: string, kind: RewardKind, intentId: string, context: RewardContext = {}): void {
  completeRewardIntent({ readPending, writePending }, gameId, kind, intentId, context);
}

export function watchVerifiedReward(gameId: string, kind: RewardKind, context: RewardContext = {}): Promise<string | null> {
  return requestVerifiedReward({
    supported: supportsRewardVerification,
    request: apiFetch,
    show: showRewardedAdForReward,
    readPending,
    writePending,
    wait: () => new Promise(resolve => setTimeout(resolve, 1500)),
  }, gameId, kind, context);
}
