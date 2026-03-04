/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        russian: {
          blue: '#003580',
          red: '#CC0000',
          gold: '#FFD700',
        },
      },
    },
  },
  plugins: [],
};
