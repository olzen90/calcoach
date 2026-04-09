/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Llama Life inspired vibrant palette
        primary: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#ffcdc9',
          300: '#fda4a2',
          400: '#f97068',
          500: '#ef4444', // Main red
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        accent: {
          purple: '#a855f7',
          pink: '#ec4899',
          orange: '#f97316',
          yellow: '#eab308',
          green: '#22c55e',
          teal: '#14b8a6',
          blue: '#3b82f6',
        },
        // Custom semantic colors
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        // Background colors
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#fafafa',
          tertiary: '#f5f5f5',
        }
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Fredoka', 'Nunito', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'playful': '0 4px 14px 0 rgba(0, 0, 0, 0.1)',
        'playful-lg': '0 10px 25px -3px rgba(0, 0, 0, 0.1)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.4)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.4)',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'flame': 'flame 1s ease-in-out infinite alternate',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        flame: {
          '0%': { transform: 'scale(1) rotate(-2deg)' },
          '100%': { transform: 'scale(1.1) rotate(2deg)' },
        },
      },
    },
  },
  plugins: [],
}
