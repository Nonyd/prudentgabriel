import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        choc: "#442913",
        nut: "#5C3422",
        lightbr: "#98755B",
        cream: "#E2D1C2",
        sand: "#D4BBAC",
        ivory: "#F7F2EC",
        bg: "#F0E8DD",
        "text-dark": "#2A1A0E",
        "text-mid": "#6B4C35",
        "text-light": "#A08060",
        success: "#2D7D4F",
        warning: "#B87333",
        danger: "#8B2020",
        info: "#1A5C8B",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant", "serif"],
        sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
      },
      borderRadius: {
        sm: "2px",
        md: "4px",
        lg: "6px",
        xl: "8px",
      },
      maxWidth: {
        site: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;
