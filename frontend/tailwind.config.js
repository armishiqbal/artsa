/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        soc: {
          bg: '#0B0F19',
          surface: '#151B2B',
          elevated: '#1E2538',
          border: '#2A344B',
          critical: '#FF4D4D',
          high: '#FF9F43',
          medium: '#FECA57',
          low: '#2ED573',
          info: '#3742FA',
          accent: '#7D3CFF',
          text: '#F1F2F6',
          muted: '#A4B0BE',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        soc: '0 4px 20px -2px rgba(0, 0, 0, 0.5), 0 2px 6px -1px rgba(0, 0, 0, 0.3)',
        glow: '0 0 15px -3px rgba(125, 60, 255, 0.3)',
        critical: '0 0 15px -3px rgba(255, 77, 77, 0.4)',
      },
    },
  },
  plugins: [],
};
