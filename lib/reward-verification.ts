import { apiFetch } from './api';
import { showRewardedAdForReward, supportsRewardVerification } from './ads';
import { requestVerifiedReward, type RewardKind, type RewardContext } from './reward-verification-core';

export function watchVerifiedReward(gameId: string, kind: RewardKind, context: RewardContext = {}): Promise<string | null> {
  return requestVerifiedReward({
    supported: supportsRewardVerification,
    request: apiFetch,
    show: showRewardedAdForReward,
    readPending: key => { try { return window.localStorage.getItem(key); } catch { return null; } },
    writePending: (key, value) => { try { if (value) window.localStorage.setItem(key, value); else window.localStorage.removeItem(key); } catch {} },
    wait: () => new Promise(resolve => setTimeout(resolve, 1500)),
  }, gameId, kind, context);
}
