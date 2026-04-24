import { Suspense } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
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
      <div className="sticky top-0 z-40 bg-[var(--white)]">
        <AnnouncementBar messages={announce} />
        <Suspense
          fallback={
            <div className="h-[60px] border-b border-mid-grey bg-[var(--white)] lg:h-[72px]" aria-hidden />
          }
        >
          <Navbar />
        </Suspense>
      </div>
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
