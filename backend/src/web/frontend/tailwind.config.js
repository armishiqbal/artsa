/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0b0f19',
          card: '#161c2d',
          border: '#232d45',
          neonBlue: '#38bdf8',
          neonGreen: '#34d399',
          neonPurple: '#a78bfa',
          neonRed: '#f87171',
          neonYellow: '#fbbf24'
        }
      }
    },
  },
  plugins: [],
}
