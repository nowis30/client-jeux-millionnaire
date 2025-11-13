import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    // Autoriser les images distantes (photos réalistes) depuis picsum.photos (ou à remplacer par vos domaines)
    domains: ['picsum.photos'],
  },
};

export default withPWA({
  dest: 'public',
  disable: isDev,
  register: true,
  skipWaiting: true,
  // Cache audio mp3 avec stratégie cache-first (peu modifié)
  runtimeCaching: [
    {
      urlPattern: /^https?:.*\.(?:mp3)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'hm-audio-cache',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
})(nextConfig);
