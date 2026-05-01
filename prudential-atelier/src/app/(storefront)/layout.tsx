import { StorefrontSiteHeader } from "@/components/layout/StorefrontSiteHeader";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchModal } from "@/components/layout/SearchModal";
import { getContent, getContentSettings } from "@/lib/settings";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  let content: Record<string, string> = {};
  try {
    content = await getContentSettings();
  } catch {
    content = {};
  }
  const announce = [
    getContent(content, "content_announce_1", "FREE SHIPPING ON ORDERS OVER ₦150,000 WITHIN LAGOS"),
    getContent(content, "content_announce_2", "NEW COLLECTION — THE EDIT IS NOW LIVE"),
    getContent(content, "content_announce_3", "BOOK YOUR BESPOKE CONSULTATION TODAY"),
  ];

  return (
    <>
      <StorefrontSiteHeader messages={announce} />
      <main className="min-h-screen">{children}</main>
      <Footer
        tagline={getContent(content, "content_footer_tagline", "Lagos, Nigeria")}
        copyrightLine={getContent(content, "content_footer_copyright", `© ${new Date().getFullYear()} Prudent Gabriel. All Rights Reserved.`)}
      />
      <CartDrawer />
      <SearchModal />
    </>
  );
}
