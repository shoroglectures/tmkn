/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:'#eafbf3',100:'#c9f1de',200:'#a7e7c8',300:'#78d8aa',
          400:'#45c987',500:'#17b978',600:'#008f61',700:'#006747',
          800:'#004d39',900:'#003b2c',
        },
        gold: { 400:'#fbbf24', 500:'#f59e0b', 600:'#d97706' },
      },
      fontFamily: { sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};