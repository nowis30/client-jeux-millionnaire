"use client";
import { useEffect, useState } from 'react';
import { apiFetch, API_BASE } from '../../lib/api';

export default function DebugAuthPage() {
  const [me, setMe] = useState<any>(null);
  const [tokenPayload, setTokenPayload] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [localToken, setLocalToken] = useState<string | null>(null);
  const pushErr = (m: string) => setErrors(e => [...e, m]);

  useEffect(() => {
    try { setLocalToken(localStorage.getItem('HM_TOKEN')); } catch { pushErr('Impossible de lire HM_TOKEN'); }
    (async () => {
      try {
        const m = await apiFetch('/api/auth/me');
        setMe(m);
      } catch (e: any) {
        pushErr('/api/auth/me échec: ' + (e?.message || 'inconnu'));
      }
      try {
        const res = await fetch(`${API_BASE}/api/auth/debug-token`, { credentials: 'include', headers: localToken ? { Authorization: `Bearer ${localToken}` } : {} });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          pushErr('/api/auth/debug-token status ' + res.status + ' ' + (body.error || res.statusText));
        } else {
          const body = await res.json();
          setTokenPayload(body.payload);
        }
      } catch (e: any) {
        pushErr('/api/auth/debug-token fetch error: ' + (e?.message || 'inconnu'));
      }
    })();
  }, [localToken]);

  return (
    <main className="max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Debug Auth</h1>
      <div className="p-3 rounded bg-neutral-900 border border-neutral-700 text-xs space-y-2">
        <p><strong>API_BASE:</strong> {API_BASE}</p>
        <p><strong>HM_TOKEN localStorage:</strong> {localToken || 'null'}</p>
        <p><strong>Me:</strong> {me ? JSON.stringify(me) : 'null'}</p>
        <p><strong>Payload JWT:</strong> {tokenPayload ? JSON.stringify(tokenPayload) : 'null'}</p>
        {errors.length > 0 && (
          <div className="space-y-1">
            <p className="text-red-400 font-medium">Erreurs:</p>
            {errors.map((e,i) => <p key={i} className="text-red-300">• {e}</p>)}
          </div>
        )}
      </div>
      <p className="text-xs opacity-70">Si le payload est null mais HM_TOKEN présent, le serveur rejette le token (expiré ou mauvais). Reconnectez-vous sur /login.</p>
    </main>
  );
}