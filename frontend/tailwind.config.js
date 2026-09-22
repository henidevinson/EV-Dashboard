/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ev: {
          bg: '#040609',
          card: '#0a0e17',
          cyan: '#00f0ff',
          teal: '#0ea5e9',
          amber: '#f59e0b',
          red: '#ff2d55',
          green: '#10b981',
          muted: '#334155',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};