import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchModal } from "@/components/layout/SearchModal";
import { ANNOUNCEMENT_SPEED_MS, cmsBool, cmsGet, cmsJson } from "@/lib/cms";
import {
  STOREFRONT_CACHE_TAGS,
  getCachedCMSContent,
  getNavCollections,
} from "@/lib/storefront-cache";

const ANNOUNCEMENT_KEYS = ["announcement_bar_enabled", "announcement_bar_messages", "announcement_bar_speed"] as const;

const FOOTER_KEYS = [
  "footer_tagline",
  "footer_house_links",
  "footer_client_links",
  "footer_newsletter_headline",
  "footer_newsletter_placeholder",
  "footer_copyright",
] as const;

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [announcementCms, footerCms, collections] = await Promise.all([
    getCachedCMSContent([...ANNOUNCEMENT_KEYS], STOREFRONT_CACHE_TAGS.cmsChrome),
    getCachedCMSContent([...FOOTER_KEYS], STOREFRONT_CACHE_TAGS.cmsChrome),
    getNavCollections(),
  ]);

  const showAnnouncement = cmsBool(announcementCms, "announcement_bar_enabled", true);
  const messages = cmsJson<string[]>(announcementCms, "announcement_bar_messages", [
    "WORLDWIDE SHIPPING · ₦ · $ · £",
    "COMPLIMENTARY STYLING CONSULTATION WITH EVERY ATELIER COMMISSION",
  ]);
  const speedKey = cmsGet(announcementCms, "announcement_bar_speed", "medium");
  const intervalMs = ANNOUNCEMENT_SPEED_MS[speedKey] ?? 3000;

  return (
    <div className="storefront-shell" data-announcement={showAnnouncement ? "on" : "off"}>
      <div className="storefront-field" aria-hidden="true" />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <Navbar
        collections={collections}
        showAnnouncement={showAnnouncement}
        announcementMessages={messages}
        announcementIntervalMs={intervalMs}
      />
      <main id="main-content" tabIndex={-1} className="storefront-main min-h-screen">
        {children}
      </main>
      <div className="relative z-[1]">
        <Footer cms={footerCms} />
      </div>
      <CartDrawer />
      <SearchModal />
    </div>
  );
}
