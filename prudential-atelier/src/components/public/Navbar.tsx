"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

const LEFT_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/consultation", label: "Consultation" },
];

const RIGHT_LINKS = [
  { href: "/account/orders", label: "Track Order" },
  { href: "/journal", label: "Journal" },
];

const MOBILE_LINKS = [...LEFT_LINKS, ...RIGHT_LINKS];

function BrandWordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group block text-center", className)}>
      <span className="block font-serif text-[clamp(1.25rem,2.5vw,1.75rem)] font-medium uppercase tracking-[0.28em] text-choc transition-colors group-hover:text-nut">
        Prudential
      </span>
      <span className="mt-0.5 block font-sans text-[9px] font-medium uppercase tracking-[0.38em] text-text-mid">
        Atelier
      </span>
    </Link>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="font-sans text-[10px] font-medium uppercase tracking-[0.16em] text-text-mid transition-colors hover:text-choc"
    >
      {label}
    </Link>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative text-text-mid transition-colors hover:text-choc"
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { totalItems, openCart, openSearch } = useCartStore();

  return (
    <>
      <div className="bg-choc py-2.5 text-center">
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-cream">
          Worldwide Shipping · ₦ · $ · £
        </p>
      </div>

      <header className="sticky top-0 z-50 bg-ivory">
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
            <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary left">
              {LEFT_LINKS.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 lg:justify-center">
            <BrandWordmark />
          </div>

          <div className="relative ml-auto flex items-center justify-end gap-5 lg:ml-0">
            <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary right">
              {RIGHT_LINKS.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>

            <div className="flex items-center gap-3 sm:gap-4">
              <IconButton onClick={openSearch} label="Search">
                <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </IconButton>
              <Link
                href="/account"
                className="text-text-mid transition-colors hover:text-choc"
                aria-label="Account"
              >
                <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                onClick={openCart}
                className="relative text-text-mid transition-colors hover:text-choc"
                aria-label="Cart"
              >
                <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} />
                {totalItems > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-choc px-1 font-sans text-[9px] font-semibold text-cream">
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
          <BrandWordmark />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-choc" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 border-t border-sand/60 p-6" aria-label="Mobile">
          {MOBILE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-sand/60 py-3 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-mid"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
