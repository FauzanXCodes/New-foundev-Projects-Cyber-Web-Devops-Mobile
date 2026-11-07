/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'serif': ['Crimson Text', 'serif'],
        'sans': ['Inter', 'sans-serif'],
        display: ["Inter", "sans-serif"],
      },
      colors: {
        primary: "#1d8cf8",
        "background-light": "#f8fafc",
        "background-dark": "#0f172a",
        calmBlue: {
          50: '#EFF6FB',
          100: '#D6E7FA',
          200: '#B7D4F8',
          300: '#8BBBF6',
          400: '#5B9FF3',
          500: '#3A85E1',
          600: '#2E6AC5',
          700: '#22529C',
        },
        cyan: {
          600: '#8CE3ED'
        },
        gentleGreen: {
          50: '#EBF7F1',
          100: '#CDEADD',
          200: '#A8D9C1',
          300: '#7EC9A2',
          400: '#58B183',
          500: '#3F9B6A',
          600: '#327B55',
          700: '#265D41',
        },
        softGray: {
          50: '#F8F9FA',
          100: '#E9EBEE',
          200: '#D4D9DD',
          300: '#B9BFC5',
          400: '#9199A2',
          500: '#6D7581',
          600: '#515863',
          700: '#383D46',
        },
        warmAccent: {
          50: '#FFF6EC',
          100: '#FFE5CC',
          200: '#FFD1A6',
          300: '#FFB77B',
          400: '#FF9950',
          500: '#E67A2B',
          600: '#B85F22',
          700: '#8A441A',
        },

        // New Additions
        softLavender: {
          50: '#F8F5FB',
          100: '#EDE4F7',
          200: '#D9C8F0',
          300: '#C0A8E6',
          400: '#A787DA',
          500: '#8E6AC5',
          600: '#6F4FA4',
          700: '#553B82',
        },
        blushPink: {
          50: '#FFF5F7',
          100: '#FEE3E9',
          200: '#FBC9D5',
          300: '#F7A6BC',
          400: '#F382A3',
          500: '#D9678A',
          600: '#B14F6D',
          700: '#8A3C54',
        },
        earthyBeige: {
          50: '#FDFBF7',
          100: '#F7F1E8',
          200: '#EDE0CF',
          300: '#E1CDAF',
          400: '#D3B28F',
          500: '#B7906F',
          600: '#8F6E54',
          700: '#6A5040',
        },
        softPeach: {
          50: '#FFF6F3',
          100: '#FFE6E1',
          200: '#FFCCC1',
          300: '#FFAD9E',
          400: '#FF907A',
          500: '#E66A51',
          600: '#B84F3E',
          700: '#8A382B',
        },
      },
      borderRadius: {
        DEFAULT: "0.75rem",
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}