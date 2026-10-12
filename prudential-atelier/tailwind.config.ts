import type { Config } from "tailwindcss";

/**
 * Type sizes scale with --type-scale (default 1), not with the root font size.
 * Spacing is rem-based, so raising html font-size would zoom the whole layout;
 * this knob changes text only. Admin and staff raise it in their layouts.
 */
const scaled = (size: string) => `calc(${size} * var(--type-scale, 1))`;
const named = (size: string, lineHeight: string): [string, { lineHeight: string }] => [
  scaled(size),
  { lineHeight: scaled(lineHeight) },
];
/** `text-11px` = the old `text-[11px]`, scaled. */
const PX_SIZES = [9, 10, 11, 12, 13, 14, 15, 20, 22, 24, 28, 32, 36, 40];

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
        "ivory-dark": "var(--ivory-dark)",
        olive: {
          DEFAULT: "var(--olive)",
          hover: "var(--olive-hover)",
          light: "var(--olive-light)",
          mid: "var(--olive-mid)",
        },
        charcoal: {
          DEFAULT: "var(--charcoal)",
          mid: "var(--charcoal-mid)",
          light: "var(--charcoal-light)",
        },
        canvas: "var(--canvas)",
        ink: "var(--ink)",
        border: "var(--border-color)",
        white: "var(--white)",
        "off-white": "var(--off-white)",
        "light-grey": "var(--light-grey)",
        "mid-grey": "var(--mid-grey)",
        "dark-grey": "var(--dark-grey)",
        "bride-accent": "var(--bride-accent)",
        "bride-bg": "var(--bride-bg)",
        "bride-dark": "var(--bride-dark)",
        bg: "var(--bg-surface)",
        "bg-page": "var(--bg-page)",
        "bg-card": "var(--bg-card)",
        "input-bg": "var(--input-bg)",
        "input-border": "var(--input-border)",
        "hero-bg": "var(--hero-bg)",
        "sidebar-bg": "var(--sidebar-bg)",
        "footer-bg": "var(--footer-bg)",
        "text-dark": "var(--text-primary)",
        "text-mid": "var(--text-mid)",
        "text-light": "var(--text-light)",
        error: "var(--error)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        wine: {
          DEFAULT: "var(--wine)",
          hover: "var(--wine-hover)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          hover: "var(--gold-hover)",
        },
        "footer-dark": "var(--footer-bg)",
        "dark-nut": "#3a1f0c",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Cormorant Garamond", "serif"],
        label: ["var(--font-jost)", "Jost", "sans-serif"],
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
      fontSize: {
        xs: named("0.75rem", "1rem"),
        sm: named("0.875rem", "1.25rem"),
        base: named("1rem", "1.5rem"),
        lg: named("1.125rem", "1.75rem"),
        xl: named("1.25rem", "1.75rem"),
        "2xl": named("1.5rem", "2rem"),
        "3xl": named("1.875rem", "2.25rem"),
        ...Object.fromEntries(PX_SIZES.map((n) => [`${n}px`, scaled(`${n}px`)])),
      },
    },
  },
  plugins: [],
};

export default config;
