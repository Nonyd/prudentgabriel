/**
 * Slice AD — glass design-system primitives, then nav pill + cart drawer.
 *
 *   pnpm test:slice-ad
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => readFileSync(join(root, rel), "utf8");

function run() {
  const tokens = src("src/styles/tokens.css");
  const glass = src("src/styles/glass.css");
  const globals = src("src/styles/globals.css");
  const nav = src("src/components/public/Navbar.tsx");
  const cart = src("src/components/layout/CartDrawer.tsx");
  const layout = src("src/app/(storefront)/layout.tsx");
  const admin = src("src/components/admin/AdminShell.tsx");
  const pkg = src("package.json");

  assert(globals.includes('@import "./glass.css"'), "globals imports the glass sheet");

  assert(tokens.includes("--glass-1-fill: rgb(255 255 255 / 0.58)"), "glass-1 light fill, tuned over the hero video");
  assert(tokens.includes("--glass-2-fill: rgb(255 255 255 / 0.62)"), "glass-2 light fill");
  assert(tokens.includes("--glass-3-fill: rgb(255 255 255 / 0.86)"), "glass-3 light fill");
  assert(tokens.includes("--glass-1-blur: 28px"), "glass-1 blur");
  assert(tokens.includes("--glass-2-blur: 24px"), "glass-2 blur");
  assert(tokens.includes("--glass-3-blur: 32px"), "glass-3 blur");
  assert(tokens.includes("--glass-1-fill: rgb(68 41 19 / 0.66)"), "glass-1 dark fill is choc-deep");
  assert(tokens.includes("--glass-2-fill: rgb(68 41 19 / 0.58)"), "glass-2 dark fill");
  assert(tokens.includes("--glass-3-fill: rgb(68 41 19 / 0.82)"), "glass-3 dark fill");
  assert(tokens.includes("--choc-deep: #442913"), "physical choc never inverts");
  assert(tokens.includes("--ivory-deep: #f7f2ec"), "physical ivory never inverts");
  assert(tokens.includes("inset 0 1px 0"), "top-edge highlight is a token");
  assert(tokens.includes("--glass-1-blur: 16px"), "mobile halves the 28px blur");

  assert(glass.includes(".glass-1"), "glass-1 class");
  assert(glass.includes(".glass-2"), "glass-2 class");
  assert(glass.includes(".glass-3"), "glass-3 class");
  assert(glass.includes(".glass-opaque"), "opaque sibling for data surfaces");
  assert(glass.includes("prefers-reduced-transparency"), "Apple reduced-transparency fallback");
  assert(glass.includes("@supports not ((backdrop-filter: blur(1px))"), "no-backdrop-filter fallback");
  assert(glass.includes("storefront-field"), "storefront field");
  assert(glass.includes("admin-field"), "admin field");
  assert(glass.includes("@keyframes field-drift"), "storefront field drifts");
  assert(glass.includes("prefers-reduced-motion: reduce"), "field stops under reduced motion");
  assert(!/storefront-field::before[\s\S]*?filter:\s*blur/.test(glass), "field must not use a live filter:blur");
  assert(glass.includes("photography-only"), "gallery grid stays full-bleed, not glass tiles");
  assert(glass.includes("translateY(-1px)"), "panel hover is a 1px lift");
  const liftHover = glass.match(/\.glass-lift:hover\s*\{[^}]+\}/);
  assert(liftHover, "glass-lift hover rule exists");
  assert(!liftHover[0].includes("scale"), "panel hover must not scale");

  assert(layout.includes("storefront-field"), "storefront mounts the field");
  assert(layout.includes("storefront-shell"), "storefront shell wraps chrome");
  assert(admin.includes("admin-field"), "admin mounts the static field");
  assert(glass.includes("animation: none"), "reduced motion kills the drift, admin never had it");

  assert(nav.includes("glass-1"), "nav pill is glass-1");
  assert(nav.includes("glass-pill"), "nav uses the pill radius");
  assert(nav.includes("storefront-nav"), "nav is the detached overlay");
  assert(cart.includes("glass-1"), "cart drawer is glass-1");
  assert(cart.includes("glass-panel"), "cart uses the panel radius");
  assert(!nav.includes("tracking-[0.2em]"), "nav dropped the tracked-out eyebrow cadence");
  assert(!cart.includes("uppercase tracking"), "cart heading is not a tracked eyebrow");

  assert(pkg.includes("test:slice-ad"), "package.json exposes the slice AD script");

  console.log("slice-ad: all checks passed");
}

run();
