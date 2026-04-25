"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/common/BrandLogo";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Heart, User, ShoppingBag, Menu, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { MobileMenu } from "./MobileMenu";

const RTW_SUBLINKS: { label: string; href: string }[] = [
  { label: "All Ready to Wear", href: "/rtw" },
  { label: "New Arrivals", href: "/rtw?sort=newest" },
  { label: "Dresses", href: "/rtw?tags=dress" },
  { label: "Jumpsuits", href: "/rtw?tags=jumpsuit" },
  { label: "Sets", href: "/rtw?tags=set" },
  { label: "Suits", href: "/rtw?tags=suit" },
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
  const { data: session } = useSession();
  const { totalItems, openCart, openSearch } = useCartStore();
  const wishlistCount = useWishlistStore((s) => s.ids.length);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const rtwActive = pathname.startsWith("/rtw");

  const desktopActive = useMemo(
    () => ({
      home: pathname === "/",
      atelier: pathname.startsWith("/atelier"),
      bridal: pathname.startsWith("/bridesals"),
      rtw: rtwActive,
      consultation: pathname.startsWith("/consultation"),
    }),
    [pathname, rtwActive],
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
              <NavLink href="/" label="Home" active={desktopActive.home} />
              <NavLink href="/atelier" label="Atelier" active={desktopActive.atelier} />
              <NavLink href="/bridesals" label="Bridal" active={desktopActive.bridal} />
              <div className="group relative before:absolute before:left-0 before:top-full before:z-40 before:h-3 before:w-full before:content-['']">
                <Link
                  href="/rtw"
                  className={cn(
                    "inline-flex items-center gap-0.5 whitespace-nowrap border-b font-body text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-200 xl:text-[11px] xl:tracking-[0.15em]",
                    desktopActive.rtw
                      ? "border-olive text-olive"
                      : "border-transparent text-charcoal hover:text-olive",
                  )}
                >
                  Ready to Wear
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-60" strokeWidth={1.75} aria-hidden />
                </Link>
                <div
                  className="invisible absolute left-0 top-full z-50 w-[200px] border-x border-b border-mid-grey bg-white opacity-0 shadow-sm transition-[opacity,visibility] duration-150 group-hover:visible group-hover:opacity-100"
                  role="menu"
                >
                  {RTW_SUBLINKS.map((s) => (
                    <Link
                      key={s.href + s.label}
                      href={s.href}
                      role="menuitem"
                      className="block px-5 py-2.5 font-body text-[12px] text-charcoal transition-colors hover:bg-[#FAFAFA] hover:text-olive"
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
              <NavLink href="/consultation" label="Book a Consultation" active={desktopActive.consultation} />
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
