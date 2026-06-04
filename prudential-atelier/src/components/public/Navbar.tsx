"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Menu, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/bespoke", label: "Bespoke" },
  { href: "/bridal", label: "Bridal" },
  { href: "/kids", label: "Kids" },
  { href: "/journal", label: "Journal" },
  { href: "/our-story", label: "About" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-sand bg-ivory">
        <div className="mx-auto flex h-16 max-w-site items-center justify-between px-6 lg:px-10">
          <Link href="/" className="font-serif text-xl font-medium tracking-[0.12em]">
            <span className="text-choc">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-mid transition-colors hover:text-choc"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="text-text-mid transition-colors hover:text-choc"
              aria-label="Search"
            >
              <Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
            <Link
              href="/account/wishlist"
              className="hidden text-text-mid transition-colors hover:text-choc sm:inline-flex"
              aria-label="Wishlist"
            >
              <Heart className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Link>
            <Link
              href="/account"
              className="text-text-mid transition-colors hover:text-choc"
              aria-label="Account"
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </Link>
            <Link href="/consultation" className="btn-primary hidden sm:inline-flex">
              Book Consultation
            </Link>
            <button
              type="button"
              className="text-choc lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
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
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <span className="font-serif text-lg tracking-[0.12em] text-choc">Menu</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-choc" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-6" aria-label="Mobile">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-sand/60 py-3 font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-text-mid"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/consultation"
            onClick={() => setOpen(false)}
            className="btn-primary mt-6 text-center"
          >
            Book Consultation
          </Link>
        </nav>
      </aside>
    </>
  );
}
