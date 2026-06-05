"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useAuthModalStore } from "@/store/authModalStore";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getSubBrand } from "@/lib/sub-brand";

type CollectionNav = { name: string; slug: string };

const PRIMARY_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/bridal", label: "Bridal" },
  { href: "/atelier", label: "Atelier" },
  { href: "/kids", label: "Kids" },
  { href: "/journal", label: "Journal" },
  { href: "/about", label: "About" },
] as const;

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

function RtwDropdown({ collections }: { collections: CollectionNav[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        href="/rtw"
        className="inline-flex items-center gap-1 uppercase transition-colors hover:opacity-80"
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          color: "var(--text-mid)",
        }}
      >
        Ready to Wear
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-150", open && "rotate-180")}
          strokeWidth={2}
        />
      </Link>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 min-w-[220px] pt-3"
          >
            <div
              className="border-b py-3 shadow-sm"
              style={{
                backgroundColor: "var(--ivory)",
                borderColor: "var(--sand)",
              }}
            >
              <Link
                href="/rtw"
                className="block px-5 py-2 transition-colors hover:opacity-80"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: "var(--text-mid)",
                }}
              >
                All Ready-to-Wear
              </Link>
              <div className="my-2 border-t" style={{ borderColor: "var(--sand)" }} />
              <Link
                href="/collections"
                className="block px-5 py-2 transition-colors hover:text-choc"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: "var(--text-mid)",
                }}
              >
                All Collections
              </Link>
              <div className="my-2 border-t" style={{ borderColor: "var(--sand)" }} />
              <p
                className="px-5 py-1 uppercase"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "9px",
                  letterSpacing: "0.18em",
                  color: "var(--lightbr)",
                }}
              >
                By edit
              </p>
              {collections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  className="block px-5 py-2 transition-colors hover:text-choc"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: "11px",
                    color: "var(--text-mid)",
                  }}
                >
                  {c.name}
                </Link>
              ))}
              <div className="my-2 border-t" style={{ borderColor: "var(--sand)" }} />
              <Link
                href="/rtw?sort=newest"
                className="block px-5 py-2 transition-colors hover:opacity-80"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: "var(--text-mid)",
                }}
              >
                New Arrivals
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MobileRtwSection({
  collections,
  onClose,
}: {
  collections: CollectionNav[];
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  const linkStyle = {
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.14em",
    color: "var(--text-mid)",
  } as const;

  return (
    <div className="border-b border-sand/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-3 uppercase"
        style={linkStyle}
      >
        Ready to Wear
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="pb-3 pl-4">
          <Link href="/rtw" onClick={onClose} className="block py-2 text-[11px] text-text-mid">
            All Ready-to-Wear
          </Link>
          <button
            type="button"
            onClick={() => setCollectionsOpen((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-left text-[10px] uppercase tracking-[0.16em] text-lightbr"
          >
            Collections
            <ChevronDown className={cn("h-3 w-3 transition-transform", collectionsOpen && "rotate-180")} />
          </button>
          <Link href="/collections" onClick={onClose} className="block py-2 pl-3 text-[11px] text-text-mid">
            All Collections
          </Link>
          {collectionsOpen
            ? collections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  onClick={onClose}
                  className="block py-2 pl-3 text-[11px] text-text-mid"
                >
                  {c.name}
                </Link>
              ))
            : null}
          <Link href="/rtw?sort=newest" onClick={onClose} className="block py-2 text-[11px] text-text-mid">
            New Arrivals
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const subBrand = getSubBrand(pathname);
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionNav[]>([]);
  const { totalItems, openCart, openSearch } = useCartStore();
  const { status } = useSession();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { collections?: CollectionNav[] } | null) => {
        if (data?.collections) {
          setCollections(data.collections.map((c) => ({ name: c.name, slug: c.slug })));
        }
      })
      .catch(() => {});
  }, []);

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
              <NavLink href="/shop" label="Shop" />
              <RtwDropdown collections={collections} />
              {PRIMARY_LINKS.filter((l) => l.href !== "/shop").map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
            <Logo variant="dark" size="md" subBrand={subBrand} />
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
          <Logo variant="dark" size="sm" subBrand={subBrand} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-choc" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 border-t border-sand/60 p-6" aria-label="Mobile">
          <Link
            href="/shop"
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
            Shop
          </Link>
          <MobileRtwSection collections={collections} onClose={() => setOpen(false)} />
          {PRIMARY_LINKS.filter((l) => l.href !== "/shop").map((link) => (
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
