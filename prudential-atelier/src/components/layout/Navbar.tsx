"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/common/BrandLogo";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Heart, User, ShoppingBag, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { MobileMenu } from "./MobileMenu";

const DESKTOP_LINKS: { label: string; href: string; active: (pathname: string, category: string | null) => boolean }[] = [
  { label: "Home", href: "/", active: (p) => p === "/" },
  { label: "Atelier", href: "/atelier", active: (p) => p.startsWith("/atelier") },
  { label: "Bridesals", href: "/bridesals", active: (p) => p.startsWith("/bridesals") },
  {
    label: "Ready to Wear",
    href: "/shop",
    active: (p, cat) => p.startsWith("/shop") && cat !== "BRIDAL",
  },
  { label: "Book a Consultation", href: "/consultation", active: (p) => p.startsWith("/consultation") },
];

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap font-body text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-200 xl:text-[11px] xl:tracking-[0.15em]",
        active ? "border-b border-olive text-olive" : "border-b border-transparent text-charcoal hover:text-olive",
      )}
    >
      {label}
    </Link>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span
      className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center bg-olive px-0.5 font-body text-[9px] font-medium leading-none text-white"
      aria-hidden
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const { data: session } = useSession();
  const { totalItems, openCart, openSearch } = useCartStore();
  const wishlistCount = useWishlistStore((s) => s.ids.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const activeMap = useMemo(
    () =>
      DESKTOP_LINKS.map((item) => ({
        ...item,
        isActive: item.active(pathname, category),
      })),
    [pathname, category],
  );

  return (
    <>
      <header
        className={cn(
          "border-b border-mid-grey bg-[var(--white)] transition-all duration-200",
          scrolled && "bg-[var(--white)]/98 shadow-[0_1px_0_0_var(--mid-grey)] backdrop-blur-sm",
        )}
      >
        <div className="mx-auto flex h-[60px] max-w-site items-center justify-between gap-2 px-4 lg:h-[72px] lg:gap-4 lg:px-8">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2 text-olive transition-opacity hover:opacity-80 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={1.75} />
            </button>
            <Link href="/" className="relative hidden h-11 w-11 shrink-0 lg:block">
              <BrandLogo width={44} height={44} priority />
            </Link>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <Link href="/" className="relative block h-10 w-10 shrink-0 lg:hidden">
              <BrandLogo width={40} height={40} priority />
            </Link>
            <nav className="hidden min-w-0 flex-nowrap items-center justify-center gap-x-3 xl:gap-x-5 2xl:gap-x-6 lg:flex">
              {activeMap.map((item) => (
                <NavLink key={item.label} href={item.href} label={item.label} active={item.isActive} />
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 lg:gap-5">
            <div className="hidden items-center gap-3 lg:flex xl:gap-5">
              <CurrencySwitcher variant="dropdown" />
              <button
                type="button"
                onClick={openSearch}
                className="text-charcoal transition-colors duration-200 hover:text-olive"
                aria-label="Search"
              >
                <Search size={18} strokeWidth={1.5} />
              </button>
              <DarkModeToggle />
              <Link
                href="/account/wishlist"
                className="relative text-charcoal transition-colors duration-200 hover:text-olive"
                aria-label="Wishlist"
              >
                <Heart size={18} strokeWidth={1.5} />
                <CountBadge count={wishlistCount} />
              </Link>
              <Link
                href={session ? "/account" : "/auth/login"}
                className="text-charcoal transition-colors duration-200 hover:text-olive"
                aria-label="Account"
              >
                <User size={18} strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                onClick={openCart}
                className="relative text-charcoal transition-colors duration-200 hover:text-olive"
                aria-label="Open cart"
              >
                <ShoppingBag size={18} strokeWidth={1.5} />
                <span className="sr-only" aria-live="polite">
                  {totalItems} items in cart
                </span>
                <CountBadge count={totalItems} />
              </button>
            </div>
            <button
              type="button"
              onClick={openCart}
              className="relative p-2 text-charcoal lg:hidden"
              aria-label="Open cart"
            >
              <ShoppingBag size={18} strokeWidth={1.5} />
              <CountBadge count={totalItems} />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
