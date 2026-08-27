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
      // These mirror the custom properties in globals.css. Components used to
      // hard-code the hex values directly, so the AA palette fix meant editing
      // 254 call sites instead of one line. Every recurring colour now has a
      // name that says what it is for.
      colors: {
        primary: {
          DEFAULT: '#247571',       // AA as text and behind white text
          hover: '#1D605C',
          light: '#EBF5F4',
          border: '#B2DDD9',
          display: '#2F8F8A',       // large text / gradients only (3:1 floor)
        },
        ink: {
          DEFAULT: '#2B2B2B',
          soft: '#4A4A4A',
          muted: '#6B6B6B',
          subtle: '#707070',
        },
        line: {
          DEFAULT: '#E6E4DF',
          strong: '#EAE6DF',
        },
        danger: {
          DEFAULT: '#C62828',
          light: '#FFEBEE',
          border: '#FFCDD2',
        },
        warn: {
          DEFAULT: '#8A5D00',
          light: '#FEF8EC',
          border: '#F5DAA0',
          fill: '#F5B942',
        },
        accent: {
          yellow: '#F5B942',
          'yellow-light': '#FEF7E6',
          coral: '#F2896B',
          'coral-strong': '#B84324',
          'coral-light': '#FDF0EC',
          blue: '#3B82F6',
          'blue-light': '#EFF6FF',
        },
        canvas: '#FAF8F5',
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
