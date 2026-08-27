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
        // These must name the fonts layout.tsx actually loads through
        // next/font. `body` previously named Inter, which is never fetched,
        // and Tailwind's default `font-sans` on <body> was overriding the
        // globals.css rule — so the Nunito the app downloads was not being
        // used for body text at all.
        sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-quicksand)', 'system-ui', 'sans-serif'],
        body: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        app: '24px',
      },
    },
  },
  plugins: [],
};
