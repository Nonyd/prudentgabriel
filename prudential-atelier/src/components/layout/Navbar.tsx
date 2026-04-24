"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search, Heart, User, ShoppingBag, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
import { useCartStore } from "@/store/cartStore";
import { MobileMenu } from "./MobileMenu";

const NAV_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Bespoke", href: "/bespoke" },
  { label: "Consultation", href: "/consultation" },
  { label: "Our Story", href: "/our-story" },
  { label: "Press", href: "/press" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const { totalItems, openCart, openSearch } = useCartStore();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed left-0 right-0 top-0 z-40 transition-all duration-300",
          scrolled
            ? "border-b border-border bg-cream/95 shadow-sm backdrop-blur-sm"
            : "bg-transparent",
        )}
      >
        <div className="mx-auto max-w-site px-6 lg:px-10">
          <div className="flex h-16 items-center justify-between lg:h-20">
            <nav className="hidden items-center gap-8 lg:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "font-label text-[11px] uppercase tracking-[0.15em] transition-colors duration-200",
                    "relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-gold",
                    "after:transition-all after:duration-300 hover:after:w-full",
                    scrolled ? "text-charcoal hover:text-wine" : "text-ivory/90 hover:text-ivory",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={cn("p-2 transition-colors lg:hidden", scrolled ? "text-charcoal" : "text-ivory")}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <Link
              href="/"
              className={cn(
                "absolute left-1/2 -translate-x-1/2 font-display text-xl font-medium uppercase tracking-[0.1em] transition-colors duration-300 lg:text-2xl",
                scrolled ? "text-wine" : "text-ivory",
              )}
            >
              Prudential Atelier
            </Link>

            <div className="flex items-center gap-1 lg:gap-3">
              <div className="hidden lg:block">
                <CurrencySwitcher />
              </div>

              <button
                type="button"
                onClick={openSearch}
                className={cn(
                  "rounded-sm p-2 transition-colors hover:bg-wine-muted",
                  scrolled ? "text-charcoal hover:text-wine" : "text-ivory/90 hover:text-ivory",
                )}
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              <Link
                href="/account/wishlist"
                className={cn(
                  "rounded-sm p-2 transition-colors hover:bg-wine-muted",
                  scrolled ? "text-charcoal hover:text-wine" : "text-ivory/90 hover:text-ivory",
                )}
                aria-label="View wishlist"
              >
                <Heart size={18} />
              </Link>

              <Link
                href={session ? "/account" : "/auth/login"}
                className={cn(
                  "rounded-sm p-2 transition-colors hover:bg-wine-muted",
                  scrolled ? "text-charcoal hover:text-wine" : "text-ivory/90 hover:text-ivory",
                )}
                aria-label="Account"
              >
                <User size={18} />
              </Link>

              {(session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN") && (
                <Link
                  href="/admin"
                  className={cn(
                    "hidden rounded-sm px-2 py-1 font-label text-[10px] uppercase tracking-wide text-gold hover:underline sm:block",
                    scrolled ? "text-gold" : "text-gold",
                  )}
                >
                  Admin
                </Link>
              )}

              <button
                type="button"
                onClick={openCart}
                className={cn(
                  "relative rounded-sm p-2 transition-colors hover:bg-wine-muted",
                  scrolled ? "text-charcoal hover:text-wine" : "text-ivory/90 hover:text-ivory",
                )}
                aria-label="Open cart"
              >
                <ShoppingBag size={18} />
                <span className="sr-only" aria-live="polite">
                  {totalItems} items in cart
                </span>
                {totalItems > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold leading-none text-charcoal" aria-hidden>
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "hidden justify-end px-10 pb-1 transition-opacity duration-300 lg:flex",
            scrolled ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <a
            href="https://pfacademy.ng"
            target="_blank"
            rel="noopener noreferrer"
            className="font-label text-[10px] uppercase tracking-[0.15em] text-gold transition-colors hover:text-gold-hover"
          >
            Fashion Academy ↗
          </a>
        </div>
      </header>

      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
