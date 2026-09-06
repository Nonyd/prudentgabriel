/**
 * Slice AD3 — admin glass: chrome blurs, data stays solid, dark uses AD0 fills.
 *
 *   pnpm test:slice-ad3
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
  const shell = src("src/components/admin/AdminShell.tsx");
  const sidebar = src("src/components/admin/AdminSidebar.tsx");
  const topbar = src("src/components/admin/AdminTopbar.tsx");
  const kpi = src("src/components/admin/ExecutiveKPICard.tsx");
  const rail = src("src/components/admin/ProductWizardRail.tsx");
  const form = src("src/components/admin/ProductFormPage.tsx");
  const alert = src("src/components/ui/AlertDialog.tsx");
  const cascade = src("src/components/admin/ProductCascadeDialog.tsx");
  const ledger = src("src/components/admin/finance/LedgerReportClient.tsx");
  const reports = src("src/components/admin/finance/HowWeAreDoingClient.tsx");
  const login = src("src/app/login/PortalLoginClient.tsx");
  const settings = src("src/app/(admin)/admin/settings/page.tsx");
  const roles = src("src/components/admin/settings/RolePermissionsPanel.tsx");
  const layout = src("src/app/layout.tsx");
  const pdp = src("src/app/(storefront)/shop/[slug]/page.tsx");
  const reviews = src("src/components/product/ReviewsSection.tsx");
  const pkg = src("package.json");
  const nav = src("src/lib/admin-route-access.ts");

  assert(tokens.includes("--glass-1-fill: rgb(68 41 19 / 0.66)"), "dark glass-1 is choc-deep, not inverted light");
  assert(tokens.includes("--glass-edge: rgb(255 255 255 / 0.14)"), "dark edge is AD0 .14");
  assert(!globals.includes("until AD3 builds dark glass"), "admin no longer locks daylight tokens");
  assert(!globals.includes("--glass-1-fill: rgb(255 255 255 / 0.58)"), "admin-area does not override glass fills");

  assert(glass.includes("opacity: 0.22"), "admin field is quieter than the storefront");
  assert(glass.includes("[data-theme=\"dark\"] .admin-field::before"), "admin field has a choc-deep dark wash");
  const adminFieldRule = glass.match(/\.admin-field::before \{\s*\/\* Quieter[\s\S]*?\n\}/);
  assert(adminFieldRule, "admin field has its own quieter rule");
  assert(!adminFieldRule[0].includes("animation"), "admin field does not drift");

  assert(shell.includes("admin-field"), "admin still mounts the field");
  assert(shell.includes("bg-transparent"), "admin shell lets the field show");
  assert(shell.includes("data-admin-chrome"), "admin marks html for portalled chrome");

  assert(sidebar.includes("glass-1"), "sidebar is glass-1");
  assert(sidebar.includes("border-r-2 border-choc"), "active section is a solid edge");
  assert(!sidebar.includes("bg-[rgba(152,117,91,0.18)]"), "active section is not a fill");
  assert(sidebar.includes("visibleAdminNavSections"), "Slice T nav map is unchanged");
  assert(nav.includes("export const ADMIN_NAV_SECTIONS"), "Slice T section list still lives in admin-route-access");

  assert(topbar.includes("glass-1"), "topbar is glass-1");
  assert(topbar.includes("input-field"), "search stays a solid field");
  assert(topbar.includes("ThemeToggle"), "admin dark toggle is on the topbar");
  assert(src("src/components/admin/NotificationBell.tsx").includes("glass-1"), "bell tray is glass-1");

  assert(kpi.includes("glass-1"), "dashboard summary cards are glass-1");
  assert(src("src/components/admin/ExecutiveRevenueChart.tsx").includes("card-surface"), "charts stay solid panels");
  assert(src("src/components/admin/OutOfStockPanel.tsx").includes("card-surface"), "out-of-stock widget stays solid");

  assert(rail.includes("glass-1"), "wizard step rail is glass-1");
  assert(form.includes('const sectionClass = "glass-opaque p-8"'), "wizard step content is a solid panel");
  assert(form.includes("bg-[var(--glass-1-solid)]"), "photo drop zone is solid");

  assert(alert.includes("glass-3"), "confirm dialogs are glass-3");
  assert(cascade.includes("glass-3"), "Slice AC cascade warning is glass-3");
  assert(cascade.includes("bg-[var(--glass-1-solid)]"), "typed DELETE input is solid");

  assert(ledger.includes("admin-heading-pill"), "ledger heading is a glass pill");
  assert(ledger.includes("glass-opaque"), "ledger table is solid");
  assert(reports.includes("admin-heading-pill"), "reports heading is a glass pill");
  assert(reports.includes("glass-opaque"), "reports figures stay solid");

  assert(login.includes("glass-2"), "login panel is glass-2");
  assert(login.includes("admin-field"), "login sits on the field");
  assert(login.includes("bg-[var(--glass-1-solid)]"), "login inputs are solid");

  assert(settings.includes("glass-1"), "settings hub cards are glass-1");
  assert(roles.includes("glass-1"), "permission editor role cards are glass-1");
  assert(roles.includes("glass-opaque"), "permission grid is solid");
  assert(src("src/components/admin/AdminImpersonateBanner.tsx").includes("glass-3"), "impersonation banner is glass-3");
  assert(src("src/components/admin/AdminPreviewBanner.tsx").includes("glass-3"), "view-as-role banner is glass-3");

  assert(layout.includes("SmoothScroll"), "root dynamic import is SmoothScroll only");
  assert(pdp.includes("RelatedProducts"), "PDP dynamic import is RelatedProducts only");
  assert(src("src/components/product/RelatedProducts.tsx").includes('variant="teaser"'), "You may also like uses the same rounded teaser frames as Best sellers");
  assert(globals.includes("button:not(.rounded-none)"), "storefront and dashboard buttons share the pill radius");
  assert(src("src/components/ui/Button.tsx").includes("rounded-full"), "shared Button is a pill, not a sharp rectangle");
  assert(!reviews.includes("next/dynamic"), "reviews are not loaded through next/dynamic");
  assert(reviews.includes("Dialog.Root"), "write-review dialog stays around the form only");

  assert(src("src/app/(admin)/admin/orders/page.tsx").includes("admin-heading-pill"), "orders heading is a glass pill");
  assert(src("src/components/admin/AdminOrdersListClient.tsx").includes("glass-opaque"), "orders table is solid");

  assert(src("src/components/public/Navbar.tsx").includes("invisible pointer-events-none"), "closed mobile menu does not keep a glass layer on screen");
  assert(!src("src/styles/globals.css").includes("backdrop-filter: blur(8px)"), "gallery dots are solid, not extra blurs");

  console.log("slice-ad3: all checks passed");
}

run();
