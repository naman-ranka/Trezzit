/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'sans-serif'],
        inter: ['Inter Variable', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0f4ff',
          100: '#e0eaff',
          500: '#4F46E5',
          600: '#4338CA',
          700: '#3730A3',
        },
      },
    },
  },
  plugins: [],
};
