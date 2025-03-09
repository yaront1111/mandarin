/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Main background and UI colors
        'bg-dark': '#121212',
        'bg-card': '#1A1A1A',
        'bg-input': '#2D2D2D',

        // Brand colors
        'brand-pink': '#FF4080',
        'brand-purple': '#4A154B',

        // Text colors
        'text-primary': '#F8F8FF',
        'text-secondary': '#9E9E9E',

        // Functional colors
        'success': '#00C853',
        'warning': '#FFB300',
        'error': '#F44336',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
        'lato': ['Lato', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
