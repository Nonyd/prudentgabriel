import type { Config } from "tailwindcss";
import { PX_TEXT_SIZES } from "./src/lib/type-scale";

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
/** `text-11px` = the old `text-[11px]`, scaled. Shared with cn() (src/lib/type-scale.ts). */
const PX_SIZES = PX_TEXT_SIZES;

/**
 * Theme colours are CSS variables, which Tailwind cannot split into channels, so
 * `bg-choc/10` or `border-sand/70` used to compile to nothing. Each colour
 * becomes a function: opacity variants mix the variable with transparent.
 */
type ColorFn = (o: { opacityValue?: string }) => string;
type ColorTree = { [k: string]: string | ColorTree };
const alpha = (value: string): ColorFn => ({ opacityValue }) =>
  // Plain `bg-choc` arrives with var(--tw-bg-opacity): keep the bare variable there.
  opacityValue === undefined || String(opacityValue) === "1" || String(opacityValue).startsWith("var(")
    ? value
    : `color-mix(in srgb, ${value} calc(${opacityValue} * 100%), transparent)`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tailwind accepts colour functions; its types do not say so.
function withAlpha(tree: ColorTree): any {
  return Object.fromEntries(
    Object.entries(tree).map(([k, v]) => [k, typeof v === "string" ? (v.startsWith("var(") ? alpha(v) : v) : withAlpha(v)]),
  );
}

const config: Config = {
  // dark: follows the site theme (html[data-theme]), not the device setting: a phone in
  // dark mode on the light site was getting cream-on-cream text.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: withAlpha({
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
        "error-soft": "var(--error-soft)",
        "success-soft": "var(--success-soft)",
        "warning-soft": "var(--warning-soft)",
        "info-soft": "var(--info-soft)",
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
      }),
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
