/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          base: "#080B11",
          surface: "#0E1522",
          card: "#131D2E",
          pill: "#172338",
          hover: "#223352",
          border: "#1C2B42",
        },
        brand: {
          blue: "#2962FF",
          emerald: "#60B01C",
          cyan: "#00F0FF",
        }
      },
    },
  },
  plugins: [],
};
