/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        primary: '#f49d25',
        'background-light': '#1c1917',
        'background-dark': '#0c0a09',
        surface: '#292524',
        'surface-highlight': '#44403c',
        'text-main': '#fafaf9',
        'text-muted': '#a8a29e',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
};
