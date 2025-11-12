"use client";
import { useCallback, useEffect, useState } from "react";
import {
  initializeAds,
  isAdReady,
  isRewardedAdReady,
  showInterstitialAd,
  showRewardedAdForReward,
  isAdsSupported,
} from "../../lib/ads";

type Status = {
  native: boolean;
  adReady?: boolean;
  rewardedReady?: boolean;
  consent?: string | null;
  consentDate?: string | null;
  lastLog?: string;
};

export default function DebugAdsPage() {
  const [status, setStatus] = useState<Status>({ native: false });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const native = isAdsSupported();
    let consent: string | null = null;
    let consentDate: string | null = null;
    try {
      consent = localStorage.getItem("hm-ad-consent");
      consentDate = localStorage.getItem("hm-ad-consent-date");
    } catch {}
    let adReady: boolean | undefined;
    let rewardedReady: boolean | undefined;
    try { adReady = await isAdReady(); } catch {}
    try { rewardedReady = await isRewardedAdReady({ ignoreCooldown: true }); } catch {}
    setStatus((s) => ({ ...s, native, adReady, rewardedReady, consent, consentDate }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const log = (msg: string) => setStatus((s) => ({ ...s, lastLog: msg }));

  const onInit = async () => {
    setBusy(true);
    try {
      await initializeAds();
      log("initializeAds() OK");
    } catch (e: any) {
      log(`initializeAds() error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onShowInterstitial = async () => {
    setBusy(true);
    try {
      const ok = await showInterstitialAd();
      log(`showInterstitialAd() => ${ok}`);
    } catch (e: any) {
      log(`showInterstitialAd() error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onShowRewarded = async () => {
    setBusy(true);
    try {
      const ok = await showRewardedAdForReward({ ignoreCooldown: true, onReward: (amount, type) => {
        log(`Rewarded: ${amount} ${type}`);
      }});
      log(`showRewardedAdForReward() => ${ok}`);
    } catch (e: any) {
      log(`showRewardedAdForReward() error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onResetConsent = async () => {
    setBusy(true);
    try {
      localStorage.removeItem("hm-ad-consent");
      localStorage.removeItem("hm-ad-consent-date");
      log("Consent reset");
    } catch (e: any) {
      log(`Reset error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onSetNpa = async () => {
    setBusy(true);
    try {
      localStorage.setItem("hm-ad-consent", "npa");
      localStorage.setItem("hm-ad-consent-date", new Date().toISOString());
      await initializeAds();
      log("Consent=NPA & init OK");
    } catch (e: any) {
      log(`Set NPA error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const onSetAccepted = async () => {
    setBusy(true);
    try {
      localStorage.setItem("hm-ad-consent", "accepted");
      localStorage.setItem("hm-ad-consent-date", new Date().toISOString());
      await initializeAds();
      log("Consent=accepted & init OK");
    } catch (e: any) {
      log(`Set accepted error: ${e?.message || e}`);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Debug Ads</h1>
      <section className="grid gap-3 text-sm text-neutral-300 md:grid-cols-2">
        <div className="rounded border border-neutral-800 bg-neutral-900 p-4 space-y-2">
          <div>Native: <span className="font-mono">{String(status.native)}</span></div>
          <div>Consent: <span className="font-mono">{status.consent ?? "(null)"}</span></div>
          <div>Date: <span className="font-mono">{status.consentDate ? new Date(status.consentDate).toLocaleString() : "-"}</span></div>
          <div>Interstitial ready: <span className="font-mono">{String(status.adReady)}</span></div>
          <div>Rewarded ready: <span className="font-mono">{String(status.rewardedReady)}</span></div>
          <div>Last: <span className="font-mono">{status.lastLog ?? "-"}</span></div>
        </div>
        <div className="rounded border border-neutral-800 bg-neutral-900 p-4 space-y-2">
          <div className="font-medium mb-1">Actions</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onInit} disabled={busy} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60">Init</button>
            <button onClick={refresh} disabled={busy} className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-white disabled:opacity-60">Refresh</button>
            <button onClick={onShowInterstitial} disabled={busy} className="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60">Show Interstitial</button>
            <button onClick={onShowRewarded} disabled={busy} className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-60">Show Rewarded</button>
          </div>
          <div className="font-medium mt-3 mb-1">Consent</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onSetAccepted} disabled={busy} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-60">Set accepted</button>
            <button onClick={onSetNpa} disabled={busy} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-60">Set NPA</button>
            <button onClick={onResetConsent} disabled={busy} className="px-3 py-2 rounded bg-neutral-700 hover:bg-neutral-600 text-white disabled:opacity-60">Reset</button>
          </div>
        </div>
      </section>
      <p className="text-xs text-neutral-400">Astuce: regarde Logcat pour les tags "AdMobPlugin" et les logs "[Ads] ...".</p>
    </main>
  );
}
