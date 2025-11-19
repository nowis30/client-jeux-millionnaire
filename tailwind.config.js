/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          'Roboto',
          'Segoe UI',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        surface: {
          0: '#0f0f14', // fond global (plus sombre que neutral-950)
          1: '#1a1a1a', // surface de base
          2: '#2a2a2a', // surface élevée (cartes)
          3: '#3a3a3a', // surface encore plus élevée
          on: '#ffffff',
          muted: '#9ca3af',
          divider: '#2f2f2f',
        },
        brand: {
          green: '#4CAF50',   // Android Green
          sky: '#03A9F4',     // Android Light Blue
          orange: '#FF5722',  // Deep Orange
          amber: '#FFC107',   // Amber
          purple: '#9C27B0',  // Purple
        },
      },
      borderRadius: {
        card: '12px',
        button: '10px',
        touch: '14px',
      },
      boxShadow: {
        'elev-1': '0 2px 8px rgba(0,0,0,0.35)',
        'elev-2': '0 6px 16px rgba(0,0,0,0.35)',
        'elev-3': '0 12px 28px rgba(0,0,0,0.40)',
      },
    },
  },
  plugins: [],
};
