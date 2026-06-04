import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { SearchModal } from "@/components/layout/SearchModal";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <CartDrawer />
      <SearchModal />
    </>
  );
}
