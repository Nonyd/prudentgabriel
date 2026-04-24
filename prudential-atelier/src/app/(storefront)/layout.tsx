import { Suspense } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchModal } from "@/components/layout/SearchModal";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-40 bg-white">
        <AnnouncementBar />
        <Suspense fallback={<div className="h-[60px] border-b border-mid-grey bg-white lg:h-[72px]" aria-hidden />}>
          <Navbar />
        </Suspense>
      </div>
      <main className="min-h-screen">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchModal />
    </>
  );
}
