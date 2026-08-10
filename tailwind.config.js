/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/views/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2F8F8A',
          hover: '#247571',
          light: '#EBF5F4',
          border: '#B2DDD9',
        },
        accent: {
          yellow: '#F5B942',
          'yellow-light': '#FEF7E6',
          coral: '#F2896B',
          'coral-light': '#FDF0EC',
          blue: '#3B82F6',
          'blue-light': '#EFF6FF',
        },
        bgApp: '#FAF8F5',
        surface: '#FFFFFF',
      },
      fontFamily: {
        heading: ['Quicksand', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        app: '24px',
      },
    },
  },
  plugins: [],
};
