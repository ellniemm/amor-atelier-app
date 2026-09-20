/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAF6F1",
        ink: "#241B1D",
        wine: "#5B2333",
        wineDark: "#3E1622",
        brass: "#B08D57",
        income: "#3F7A5C",
        outcome: "#9C4A3D",
        line: "#E4DACD",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
