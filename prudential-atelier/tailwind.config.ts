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
      fontFamily: {
        display: ["var(--font-bodoni)", "Didot", "Times New Roman", "serif"],
        body: ["var(--font-jost)", "Helvetica Neue", "system-ui", "sans-serif"],
        label: ["var(--font-jost)", "system-ui", "sans-serif"],
        cormorant: ["var(--font-bodoni)", "serif"],
        "dm-sans": ["var(--font-jost)", "system-ui", "sans-serif"],
        "cormorant-sc": ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      colors: {
        white: "#FFFFFF",
        "off-white": "#F8F8F6",
        "light-grey": "#F2F2F0",
        "mid-grey": "#E8E8E4",
        "dark-grey": "#8A8A85",
        charcoal: {
          DEFAULT: "var(--charcoal)",
          mid: "var(--charcoal-mid)",
          light: "var(--charcoal-light)",
        },
        black: "#0A0A0A",
        olive: {
          DEFAULT: "var(--olive)",
          hover: "var(--olive-hover)",
          light: "var(--olive-light)",
          mid: "var(--olive-mid)",
        },
        bride: {
          bg: "#FAF7F4",
          accent: "#C8A97A",
          dark: "#2A1F1A",
        },
        wine: {
          DEFAULT: "var(--wine)",
          hover: "var(--wine-hover)",
          dark: "var(--wine-dark)",
          muted: "var(--wine-muted)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          hover: "var(--gold-hover)",
          dark: "var(--gold-dark)",
          muted: "var(--gold-muted)",
        },
        ivory: {
          DEFAULT: "var(--ivory)",
          dark: "var(--ivory-dark)",
          deeper: "var(--ivory-deeper)",
        },
        cream: "var(--cream)",
        border: "var(--border)",
        "wine-light": "var(--color-wine-light)",
        "gold-light": "var(--color-gold-light)",
        background: "var(--white)",
        foreground: "var(--charcoal)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        info: "var(--info)",
      },
      borderRadius: {
        DEFAULT: "0px",
        sm: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px",
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        "fade-up": "fadeUp 0.7s var(--ease-out) forwards",
        "fade-in": "fadeIn 0.5s var(--ease-out) forwards",
        marquee: "marquee 40s linear infinite",
        "marquee-slow": "marquee 35s linear infinite",
        "spin-slow": "spin 3s linear infinite",
        fadeUp: "fadeUp 0.7s ease forwards",
        fadeIn: "fadeIn 0.7s ease forwards",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      screens: {
        wide: "1536px",
        "3xl": "1600px",
      },
      maxWidth: {
        container: "1400px",
        site: "1400px",
      },
      spacing: {
        section: "120px",
        "section-mobile": "80px",
      },
    },
  },
  plugins: [],
};

export default config;
