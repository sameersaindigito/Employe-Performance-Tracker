/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        surface: '#111118',
        border: '#1E1E2E',
        accent: '#6366F1',
        'text-primary': '#F0F0F5',
        'text-secondary': '#8B8B9E',
        excellent: '#10B981',
        good: '#6366F1',
        average: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
