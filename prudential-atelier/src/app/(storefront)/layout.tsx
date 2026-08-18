import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchModal } from "@/components/layout/SearchModal";
import { auth } from "@/lib/auth";
import { ANNOUNCEMENT_SPEED_MS, cmsBool, cmsGet, cmsJson, getCMSContent } from "@/lib/cms";
import { enforcePublicMaintenance } from "@/lib/maintenance";

const ANNOUNCEMENT_KEYS = ["announcement_bar_enabled", "announcement_bar_messages", "announcement_bar_speed"] as const;

const FOOTER_KEYS = [
  "footer_tagline",
  "footer_house_links",
  "footer_client_links",
  "footer_newsletter_headline",
  "footer_newsletter_placeholder",
  "footer_copyright",
] as const;

export const dynamic = "force-dynamic";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  await enforcePublicMaintenance(session?.user?.role);

  const [announcementCms, footerCms] = await Promise.all([
    getCMSContent([...ANNOUNCEMENT_KEYS]),
    getCMSContent([...FOOTER_KEYS]),
  ]);

  const showAnnouncement = cmsBool(announcementCms, "announcement_bar_enabled", true);
  const messages = cmsJson<string[]>(announcementCms, "announcement_bar_messages", [
    "WORLDWIDE SHIPPING · ₦ · $ · £",
    "COMPLIMENTARY STYLING CONSULTATION WITH EVERY ATELIER COMMISSION",
  ]);
  const speedKey = cmsGet(announcementCms, "announcement_bar_speed", "medium");
  const intervalMs = ANNOUNCEMENT_SPEED_MS[speedKey] ?? 3000;

  return (
    <>
      <Navbar
        showAnnouncement={showAnnouncement}
        announcementMessages={messages}
        announcementIntervalMs={intervalMs}
      />
      <main className="min-h-screen">{children}</main>
      <Footer cms={footerCms} />
      <CartDrawer />
      <SearchModal />
    </>
  );
}
