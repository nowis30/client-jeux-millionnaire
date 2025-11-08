"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const APK_FILENAME = process.env.NEXT_PUBLIC_APK_FILENAME || "app-release.apk";
const APK_URL = process.env.NEXT_PUBLIC_APK_URL || `/${APK_FILENAME}`; // fallback vers un fichier dans /public si présent
const TRAILER_YT = process.env.NEXT_PUBLIC_TRAILER_YT || ""; // ex: https://www.youtube.com/embed/XXXXXXXX
const TRAILER_MP4 = process.env.NEXT_PUBLIC_TRAILER_MP4 || ""; // ex: https://cdn.exemple.com/trailer.mp4

export default function TelechargerPage() {
  const [ua, setUa] = useState<string>("");
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    setUa(navigator.userAgent || "");
    // Vérifier si l'APK est réellement disponible (HEAD)
    (async () => {
      try {
        const res = await fetch(APK_URL, { method: 'HEAD' });
        setApkAvailable(res.ok);
      } catch {
        setApkAvailable(false);
      }
    })();
  }, []);

  const isAndroid = useMemo(() => /Android/i.test(ua), [ua]);
  const isIOS = useMemo(() => /iPhone|iPad|iPod/i.test(ua), [ua]);

  return (
    <main className="max-w-3xl mx-auto space-y-6">
      <header>
        <h2 className="text-2xl font-bold">Télécharger l'application</h2>
        <p className="text-neutral-300 text-sm">Installez l'APK Android. La bande annonce sera ajoutée plus tard.</p>
      </header>

      {/* Bloc téléchargement APK */}
      <section className="rounded-lg border border-emerald-600/40 bg-emerald-600/10 p-4 space-y-3">
        <h3 className="font-semibold text-emerald-200">APK Android</h3>
        <p className="text-sm text-emerald-100/90">
          {isAndroid ? (
            <>Vous êtes sur Android. Après le téléchargement, ouvrez le fichier .apk et autorisez l'installation depuis le navigateur si nécessaire.</>
          ) : (
            <>Le fichier APK s'installe sur Android. Depuis iOS ou desktop, téléchargez et transférez le fichier sur un appareil Android.</>
          )}
        </p>
        {apkAvailable ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={APK_URL}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-black font-medium"
            >
              ⬇️ Télécharger l'APK
            </a>
            <span className="text-xs text-neutral-400">Lien direct: <a className="underline break-all" href={APK_URL}>{APK_URL}</a></span>
          </div>
        ) : (
          <div className="rounded border border-emerald-700/50 bg-emerald-900/20 p-3 text-sm text-neutral-200">
            <div className="font-semibold mb-1">Aucun APK détecté pour le moment</div>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Option rapide: placez votre fichier <code>app-release.apk</code> dans le dossier <code>/public</code> du projet, puis redeployez. Il sera accessible via <code>/app-release.apk</code>.</li>
              <li>Option CDN: hébergez l'APK (GitHub Releases, Cloudflare R2, S3/CDN) et définissez la variable <code>NEXT_PUBLIC_APK_URL</code> sur l'URL directe.</li>
            </ol>
            <p className="mt-2 text-xs text-neutral-400">Astuce: Vercel conseille un stockage type Blob/CDN pour les fichiers volumineux.</p>
          </div>
        )}
        <details className="text-sm text-neutral-300">
          <summary className="cursor-pointer text-neutral-200">Aide à l'installation</summary>
          <ol className="list-decimal pl-5 space-y-1 mt-2">
            <li>Téléchargez le fichier APK.</li>
            <li>Ouvrez le fichier (dans Téléchargements).</li>
            <li>Si Android bloque, allez dans Réglages → Sécurité → autoriser 'Sources inconnues' ou autoriser depuis votre navigateur.</li>
            <li>Lancez l'installation et ouvrez l'application.</li>
          </ol>
        </details>
      </section>

      {/* Bloc bande annonce (facultatif, non configuré pour le moment) */}
      <section className="rounded-lg border border-indigo-600/40 bg-indigo-600/10 p-4 space-y-3">
        <h3 className="font-semibold text-indigo-200">Bande annonce</h3>
        {TRAILER_YT ? (
          <div className="aspect-video w-full rounded overflow-hidden border border-neutral-800 bg-black">
            <iframe
              className="w-full h-full"
              src={TRAILER_YT}
              title="Bande annonce"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : TRAILER_MP4 ? (
          <video controls className="w-full rounded border border-neutral-800 bg-black">
            <source src={TRAILER_MP4} type="video/mp4" />
            Votre navigateur ne supporte pas la vidéo HTML5.
          </video>
        ) : (
          <p className="text-sm text-neutral-300">Bande annonce à venir. Vous pourrez ajouter une URL YouTube (<code className="text-neutral-200">NEXT_PUBLIC_TRAILER_YT</code>) ou un MP4 (<code className="text-neutral-200">NEXT_PUBLIC_TRAILER_MP4</code>) plus tard.</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold">Questions fréquentes</h4>
        <details className="text-sm text-neutral-300">
          <summary className="cursor-pointer text-neutral-200">Le téléchargement est lent ou échoue</summary>
          <p className="mt-1">Nous recommandons d'héberger l'APK sur un hébergement de fichiers (GitHub Releases, Cloudflare R2, Vercel Blob) et d'utiliser son lien direct dans la variable <code>NEXT_PUBLIC_APK_URL</code>.</p>
        </details>
        <details className="text-sm text-neutral-300">
          <summary className="cursor-pointer text-neutral-200">Comment mettre à jour l'APK ?</summary>
          <p className="mt-1">Uploadez la nouvelle version au même emplacement et mettez à jour l'URL si elle change. Les anciens liens peuvent rester en miroir si besoin.</p>
        </details>
      </section>

      <div className="text-sm text-neutral-400">
        Besoin d'aide ? <Link href="/contact" className="text-rose-300 hover:text-rose-200 underline">Contactez le support</Link>.
      </div>
    </main>
  );
}
