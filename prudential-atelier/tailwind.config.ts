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
        choc: "var(--choc)",
        nut: "var(--nut)",
        lightbr: "var(--lightbr)",
        cream: "var(--cream)",
        sand: "var(--sand)",
        ivory: "var(--ivory)",
        bg: "var(--bg-surface)",
        "bg-page": "var(--bg-page)",
        "bg-card": "var(--bg-card)",
        "hero-bg": "var(--hero-bg)",
        "sidebar-bg": "var(--sidebar-bg)",
        "footer-bg": "var(--footer-bg)",
        "text-dark": "var(--text-primary)",
        "text-mid": "var(--text-mid)",
        "text-light": "var(--text-light)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        wine: "#6B1C2A",
        gold: "#C9A84C",
        "footer-dark": "var(--footer-bg)",
        "dark-nut": "#3a1f0c",
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-jost)", "Jost", "sans-serif"],
        body: ["var(--font-lora)", "Lora", "serif"],
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
