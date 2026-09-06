/**
 * Slice AD2 — storefront glass rollout (homepage, chrome, pages).
 *
 *   pnpm test:slice-ad2
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
  const hero = src("src/components/public/HeroSectionClient.tsx");
  const bestsellers = src("src/components/public/BestSellers.tsx");
  const grid = src("src/components/common/ProductCardGrid.tsx");
  const doors = src("src/components/public/CategoryGrid.tsx");
  const journey = src("src/components/public/BespokeJourneySection.tsx");
  const quote = src("src/components/public/BrandQuoteSectionClient.tsx");
  const pfa = src("src/components/public/PFACrosslinkBannerClient.tsx");
  const blog = src("src/components/public/BlogPreview.tsx");
  const footer = src("src/components/public/Footer.tsx");
  const qa = src("src/components/common/quick-add/QuickAddMobile.tsx");
  const sizeModal = src("src/components/shop/SizeGuideModal.tsx");
  const search = src("src/components/layout/SearchModal.tsx");
  const auth = src("src/components/auth/AuthModal.tsx");
  const shop = src("src/components/shop/ShopBrowse.tsx");
  const pdp = src("src/components/product/ProductDetailClient.tsx");
  const checkout = src("src/components/checkout/CheckoutClient.tsx");
  const summary = src("src/components/checkout/OrderSummary.tsx");
  const success = src("src/app/(storefront)/checkout/success/page.tsx");
  const account = src("src/components/account/AccountShell.tsx");
  const nav = src("src/components/public/Navbar.tsx");
  const toaster = src("src/providers/RootProvider.tsx");
  const pkg = src("package.json");

  assert(tokens.includes("--glass-1-fill: rgb(255 255 255 / 0.58)"), "glass-1 stays the local 0.58 tune");
  assert(tokens.includes("inset 0 1px 0 rgb(255 255 255 / 0.88)"), "strengthened top highlight");

  assert(glass.includes("hero-copy-scrim"), "hero copy has a scrim under the glass panel");
  assert(hero.includes("glass-1"), "hero copy sits on glass-1");
  assert(hero.includes("hero-copy-scrim"), "hero mounts the scrim");
  assert(!hero.includes("className=\"eyebrow"), "hero dropped the tracked eyebrow");
  assert(!hero.includes("bg-hero-bg"), "hero is not a choc slab");

  assert(bestsellers.includes('variant="teaser"'), "homepage tiles are the teaser");
  assert(grid.includes('variant?: "gallery" | "teaser"'), "gallery vs teaser is explicit");
  assert(grid.includes("photography-only") || glass.includes("photography-only"), "collection lookbook stays photography-only");

  assert(doors.includes("glass-2"), "three-doors cards are glass-2");
  assert(!doors.includes("The house"), "three-doors dropped the tracked kicker");
  assert(journey.includes("glass-2"), "atelier journey panel is glass-2");
  assert(quote.includes("glass-2"), "quote sits on glass-2");
  assert(pfa.includes("glass-2"), "academy banner is glass-2 not a wine drench");
  assert(pfa.includes("rounded-full"), "academy CTA is a pill");
  assert(pfa.includes("https://pfacademy.ng"), "academy CTA opens the PFA site");
  assert(blog.includes("glass-2"), "journal teasers are glass-2 frames");
  assert(footer.includes("glass-1"), "footer is glass-1 chrome");
  assert(!footer.includes("#1A0F08"), "footer is not a solid choc slab");

  assert(qa.includes("glass-1"), "quick-add panel is glass-1");
  assert(src("src/components/common/quick-add/QuickAddMobile.tsx").includes("sticky"), "sticky bar still exists");
  assert(qa.includes('data-quick-add="sticky"'), "mobile sticky bar remains");
  const sticky = qa.slice(qa.indexOf("QuickAddStickyBarInner"));
  assert(sticky.includes("glass-1"), "mobile sticky bar is glass-1");

  assert(sizeModal.includes("glass-3"), "size chart modal is glass-3");
  assert(sizeModal.includes("glass-opaque"), "size chart table stays opaque");
  assert(search.includes("glass-3"), "search sheet is glass-3");
  assert(auth.includes("glass-3"), "auth modal is glass-3");
  assert(nav.includes("CurrencySwitcher"), "currency switcher is on the storefront nav");
  assert(toaster.includes("glass-toast") || toaster.includes("glass-1-fill"), "toasts use glass-1");

  assert(shop.includes("<ProductCardGrid"), "shop still mounts the product grid");
  assert(shop.includes('variant="teaser"'), "shop cards match the homepage teaser frames");
  assert(shop.includes("CatalogPagination"), "shop paginates instead of infinite scroll");

  assert(pdp.includes("glass-2"), "PDP info column is glass-2");
  assert(checkout.includes("glass-opaque"), "checkout steps stay readable (opaque family)");
  assert(summary.includes("glass-2"), "order summary is glass-2");
  assert(success.includes("glass-2"), "success tracker is glass-2");
  assert(account.includes("glass-1"), "account chrome is glass-1");
  assert(account.includes("glass-opaque"), "account forms sit on opaque glass-family panels");
  assert(account.includes("storefront-field"), "account mounts the field");

  assert(pkg.includes("test:slice-ad2"), "package.json exposes the slice AD2 script");

  console.log("slice-ad2: all checks passed");
}

run();
