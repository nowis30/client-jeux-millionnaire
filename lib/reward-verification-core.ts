export type RewardKind = 'quiz-token' | 'pari-token' | 'quiz-reveal' | 'bonus';
export type RewardContext = { sessionId?: string; questionId?: string };
export type RewardServices = {
  supported: () => Promise<boolean>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  show: (options: { ignoreCooldown: boolean; verification: { intentId: string; userId: string } }) => Promise<boolean>;
  readPending: (key: string) => string | null;
  writePending: (key: string, value: string | null) => void;
  wait: () => Promise<void>;
};
type Status = { verified: boolean; consumed: boolean; expired: boolean };

export function rewardStorageKey(gameId: string, kind: RewardKind, context: RewardContext = {}): string {
  return `hm-pending-ad:${gameId}:${kind}:${context.sessionId ?? ''}:${context.questionId ?? ''}`;
}

export function completeRewardIntent(services: Pick<RewardServices, 'readPending' | 'writePending'>, gameId: string, kind: RewardKind, intentId: string, context: RewardContext = {}): void {
  const key = rewardStorageKey(gameId, kind, context);
  // A delayed response from another tab must not remove a newer receipt.
  if (services.readPending(key) === intentId) services.writePending(key, null);
}

export async function requestVerifiedReward(services: RewardServices, gameId: string, kind: RewardKind, context: RewardContext = {}): Promise<string | null> {
  if (!(await services.supported())) throw new Error('Mettez l’application Android à jour pour recevoir les récompenses publicitaires.');
  const path = `/api/games/${gameId}/rewards/intents`;
  const storageKey = rewardStorageKey(gameId, kind, context);
  let id = services.readPending(storageKey);
  if (id) {
    try {
      const status = await services.request<Status>(`${path}/${encodeURIComponent(id)}`);
      if (status.consumed || status.expired) { services.writePending(storageKey, null); id = null; }
      else if (status.verified) return id;
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status !== 403 && status !== 404) throw error;
      services.writePending(storageKey, null); id = null;
    }
  }
  if (!id) {
    const intent = await services.request<{ id: string; userId: string }>(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...context }),
    });
    id = intent.id;
    services.writePending(storageKey, id);
    const shown = await services.show({ ignoreCooldown: kind === 'quiz-reveal', verification: { intentId: id, userId: intent.userId } });
    if (!shown) { services.writePending(storageKey, null); return null; }
  }
  for (let attempt = 0; attempt < 30; attempt++) {
    const status = await services.request<Status>(`${path}/${encodeURIComponent(id)}`);
    if (status.consumed || status.expired) {
      services.writePending(storageKey, null);
      throw new Error('Cette récompense a déjà été utilisée ou a expiré.');
    }
    if (status.verified) return id;
    await services.wait();
  }
  // Keep the receipt so the next tap can finish without showing another ad.
  throw new Error('La confirmation de la publicité prend plus de temps que prévu. Réessayez dans un instant pour récupérer votre récompense.');
}
