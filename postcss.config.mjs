// Tailwind CSS v4 through PostCSS, as documented for Next.js. The PostCSS
// plugin reports the source files it scans, so cached builds pick up new classes.
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};

export default config;
