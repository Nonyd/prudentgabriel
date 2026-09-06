"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useAuthModalStore } from "@/store/authModalStore";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
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
    <Link href={href} className="storefront-nav-link">
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
      <Link href="/rtw" className="storefront-nav-link inline-flex items-center gap-1">
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
            transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
            className="absolute left-0 top-full z-[80] min-w-[220px] pt-3"
          >
            <div className="glass-2 glass-panel py-3">
              <Link href="/rtw" className="block px-5 py-2 text-[13px] font-normal text-[var(--text-primary)] hover:opacity-70">
                All Ready-to-Wear
              </Link>
              <div className="my-2 border-t border-[var(--glass-edge)]" />
              <Link
                href="/collections"
                className="block px-5 py-2 text-[13px] font-normal text-[var(--text-primary)] hover:opacity-70"
              >
                All Collections
              </Link>
              <div className="my-2 border-t border-[var(--glass-edge)]" />
              <p className="px-5 py-1 text-[12px] font-normal text-text-mid">By edit</p>
              {collections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/collections/${c.slug}`}
                  className="block px-5 py-2 text-[13px] font-normal text-[var(--text-primary)] hover:opacity-70"
                >
                  {c.name}
                </Link>
              ))}
              <div className="my-2 border-t border-[var(--glass-edge)]" />
              <Link
                href="/rtw?sort=newest"
                className="block px-5 py-2 text-[13px] font-normal text-[var(--text-primary)] hover:opacity-70"
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

  return (
    <div className="border-b border-[var(--glass-edge)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left text-[14px] font-normal text-[var(--text-primary)]"
      >
        Ready to Wear
        <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <div className="pb-3 pl-4">
          <Link href="/rtw" onClick={onClose} className="block py-2 text-[13px] text-text-mid">
            All Ready-to-Wear
          </Link>
          <p className="pt-2 text-[12px] text-text-mid">Collections</p>
          <Link href="/collections" onClick={onClose} className="block py-2 pl-3 text-[13px] text-text-mid">
            All Collections
          </Link>
          {collections.map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              onClick={onClose}
              className="block py-2 pl-3 text-[13px] text-text-mid"
            >
              {c.name}
            </Link>
          ))}
          <Link href="/rtw?sort=newest" onClick={onClose} className="block py-2 text-[13px] text-text-mid">
            New Arrivals
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function HeaderUtilityIcons({
  className,
  iconClassName = "h-[18px] w-[18px]",
  gapClassName = "gap-4",
  onAccountClick,
}: {
  className?: string;
  iconClassName?: string;
  gapClassName?: string;
  onAccountClick: () => void;
}) {
  const { totalItems, openCart, openSearch } = useCartStore();
  const iconBtn = "text-[var(--text-primary)] transition-opacity hover:opacity-70";

  return (
    <div className={cn("flex shrink-0 items-center", gapClassName, className)}>
      <button type="button" onClick={openSearch} className={iconBtn} aria-label="Search">
        <Search className={iconClassName} strokeWidth={1.5} />
      </button>
      <Link href="/account/wishlist" className={iconBtn} aria-label="Wishlist">
        <Heart className={iconClassName} strokeWidth={1.5} />
      </Link>
      <button type="button" onClick={onAccountClick} className={iconBtn} aria-label="Account">
        <User className={iconClassName} strokeWidth={1.5} />
      </button>
      <CurrencySwitcher variant="dropdown" className="hidden sm:flex" />
      <ThemeToggle
        color="var(--text-primary)"
        className="relative flex h-7 w-7 items-center justify-center transition-opacity duration-200 hover:opacity-70 sm:h-8 sm:w-8"
      />
      <button type="button" onClick={openCart} className={cn("relative", iconBtn)} aria-label="Cart">
        <ShoppingBag className={iconClassName} strokeWidth={1.5} />
        {totalItems > 0 ? (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 font-sans text-[9px] font-medium"
            style={{ backgroundColor: "var(--choc-deep)", color: "var(--ivory-deep)" }}
          >
            {totalItems > 9 ? "9+" : totalItems}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function Navbar({
  collections: collectionsProp = [],
  showAnnouncement = true,
  announcementMessages = ["WORLDWIDE SHIPPING · ₦ · $ · £"],
  announcementIntervalMs = 3000,
}: {
  collections?: CollectionNav[];
  showAnnouncement?: boolean;
  announcementMessages?: string[];
  announcementIntervalMs?: number;
}) {
  const pathname = usePathname();
  const subBrand = getSubBrand(pathname);
  const [open, setOpen] = useState(false);
  const collections = collectionsProp;
  const { status } = useSession();
  const openLogin = useAuthModalStore((s) => s.openLogin);

  const handleAccountClick = () => {
    if (status === "authenticated") {
      window.location.href = "/account";
      return;
    }
    openLogin("/account");
  };

  const shopLink = PRIMARY_LINKS[0];
  const afterRtwLinks = PRIMARY_LINKS.slice(1);

  return (
    <>
      <header className="storefront-nav">
        {showAnnouncement ? (
          <AnnouncementBar messages={announcementMessages} intervalMs={announcementIntervalMs} />
        ) : null}

        <div className="storefront-nav-inner">
          <div className="glass-1 glass-pill storefront-nav-pill">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <button
                type="button"
                className="shrink-0 text-[var(--text-primary)]"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Logo
                variant="dark"
                size="sm"
                subBrand={subBrand}
                className="min-w-0 max-w-[120px] shrink sm:max-w-[140px]"
              />
            </div>

            <div className="hidden min-w-0 lg:flex lg:flex-none">
              <Logo variant="dark" size="sm" subBrand={subBrand} className="shrink-0" />
            </div>

            <nav
              className="hidden min-w-0 items-center gap-4 overflow-visible lg:flex xl:gap-6 2xl:gap-8"
              aria-label="Primary"
            >
              <NavLink href={shopLink.href} label={shopLink.label} />
              <RtwDropdown collections={collections} />
              {afterRtwLinks.map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>

            <HeaderUtilityIcons
              className="lg:hidden"
              iconClassName="h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]"
              gapClassName="gap-2 sm:gap-2.5"
              onAccountClick={handleAccountClick}
            />
            <HeaderUtilityIcons className="hidden lg:flex" onAccountClick={handleAccountClick} />
          </div>
        </div>
      </header>

      <div
        className={cn(
          "storefront-drawer-backdrop fixed inset-0 bg-[var(--choc-deep)]/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          "storefront-drawer glass-1 glass-panel fixed bottom-3 right-3 top-3 flex w-[min(320px,88vw)] flex-col transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "translate-x-[calc(100%+0.75rem)]",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <Logo variant="dark" size="sm" subBrand={subBrand} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5 text-[var(--text-primary)]" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-[var(--glass-edge)] p-6" aria-label="Mobile">
          <Link
            href={shopLink.href}
            onClick={() => setOpen(false)}
            className="border-b border-[var(--glass-edge)] py-3 text-[14px] font-normal text-[var(--text-primary)]"
          >
            {shopLink.label}
          </Link>
          <MobileRtwSection collections={collections} onClose={() => setOpen(false)} />
          {afterRtwLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-[var(--glass-edge)] py-3 text-[14px] font-normal text-[var(--text-primary)]"
            >
            {link.label}
          </Link>
          ))}
          <div className="pt-4">
            <CurrencySwitcher variant="dropdown" />
          </div>
        </nav>
      </aside>
    </>
  );
}
