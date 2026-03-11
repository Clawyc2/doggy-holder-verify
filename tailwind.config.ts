import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        doggy: {
          primary: "#FF6B35",
          secondary: "#004E89",
          accent: "#F7C59F",
        },
      },
    },
  },
  plugins: [],
};

export default config;
