import withPWA from 'next-pwa';

const isDev = process.env.NODE_ENV !== 'production';

export default withPWA({
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  images: {
    // Autoriser les images distantes (photos réalistes) depuis picsum.photos (ou à remplacer par vos domaines)
    domains: ['picsum.photos'],
  },
  pwa: {
    dest: 'public',
    disable: isDev,
    register: true,
    skipWaiting: true,
  },
});
