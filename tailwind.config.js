/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c'
        },
        ink: '#111827'
      },
      boxShadow: {
        soft: '0 18px 50px -22px rgba(15, 23, 42, 0.35)'
      },
      backgroundImage: {
        'money-gradient': 'linear-gradient(135deg, #ff9f1c 0%, #ff6b00 48%, #ef4444 100%)'
      }
    }
  },
  plugins: []
};
