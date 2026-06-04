"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useAuthModalStore } from "@/store/authModalStore";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const LEFT_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/bespoke", label: "Bespoke" },
  { href: "/bridal", label: "Bridal" },
  { href: "/kids", label: "Kids" },
  { href: "/journal", label: "Journal" },
  { href: "/our-story", label: "About" },
];

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="uppercase transition-colors hover:opacity-80"
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.14em",
        color: "var(--text-mid)",
      }}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItems, openCart, openSearch } = useCartStore();
  const { status } = useSession();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const handleAccountClick = () => {
    if (status === "authenticated") {
      window.location.href = "/account";
      return;
    }
    openLogin("/account");
  };

  return (
    <>
      <div className="bg-hero-bg py-2.5 text-center">
        <p
          className="uppercase"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "10px",
            color: "var(--cream)",
          }}
        >
          Worldwide Shipping · ₦ · $ · £
        </p>
      </div>

      <header className="sticky top-0 z-50 border-b border-sand/40 bg-ivory">
        <div className="relative mx-auto flex h-[72px] max-w-site items-center justify-between px-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-10">
          <div className="flex items-center lg:contents">
            <button
              type="button"
              className="text-choc lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav className="hidden items-center gap-6 xl:gap-8 lg:flex" aria-label="Primary left">
              {LEFT_LINKS.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
            <Logo variant="dark" size="md" />
          </div>

          <div className="relative ml-auto flex items-center justify-end gap-5 lg:ml-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={openSearch}
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--text-mid)" }}
                aria-label="Search"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
              <Link
                href="/account/wishlist"
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--text-mid)" }}
                aria-label="Wishlist"
              >
                <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                onClick={handleAccountClick}
                className="transition-colors hover:opacity-80"
                style={{ color: "var(--text-mid)" }}
                aria-label="Account"
              >
                <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </button>
              <ThemeToggle />
              <button
                type="button"
                onClick={openCart}
                className="relative transition-colors hover:opacity-80"
                style={{ color: "var(--text-mid)" }}
                aria-label="Cart"
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} />
                {totalItems > 0 ? (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 font-sans text-[9px] font-semibold"
                    style={{ backgroundColor: "var(--choc)", color: "var(--cream)" }}
                  >
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-[60] bg-choc/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[70] flex h-full w-[min(320px,88vw)] flex-col bg-ivory shadow-xl transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <Logo variant="dark" size="sm" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-choc" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 border-t border-sand/60 p-6" aria-label="Mobile">
          {LEFT_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-sand/60 py-3 uppercase"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                fontWeight: 500,
                letterSpacing: "0.14em",
                color: "var(--text-mid)",
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
