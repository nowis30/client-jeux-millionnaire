/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const dest = process.env.API_PROXY_DEST || process.env.NEXT_PUBLIC_API_BASE || 'https://server-jeux-millionnaire.onrender.com';
    if (!dest) return [];
    // Proxy toutes les routes /api vers l'API backend pour éviter CORS côté navigateur
    return [
      {
        source: '/api/:path*',
        destination: `${dest}/api/:path*`,
      },
      // Proxy Socket.IO (WebSocket) aussi vers le backend
      {
        source: '/socket.io/:path*',
        destination: `${dest}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
