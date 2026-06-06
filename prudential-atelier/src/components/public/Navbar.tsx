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
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
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
        color: "var(--cream)",
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
          color: "var(--cream)",
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

function HeaderUtilityIcons({
  className,
  iconColor,
  cartBadgeBg,
  cartBadgeFg,
  iconClassName = "h-[18px] w-[18px]",
  gapClassName = "gap-4",
  onAccountClick,
}: {
  className?: string;
  iconColor: string;
  cartBadgeBg: string;
  cartBadgeFg: string;
  iconClassName?: string;
  gapClassName?: string;
  onAccountClick: () => void;
}) {
  const { totalItems, openCart, openSearch } = useCartStore();

  const iconBtn = "transition-colors hover:opacity-80";

  return (
    <div className={cn("flex shrink-0 items-center", gapClassName, className)}>
      <button
        type="button"
        onClick={openSearch}
        className={iconBtn}
        style={{ color: iconColor }}
        aria-label="Search"
      >
        <Search className={iconClassName} strokeWidth={1.5} />
      </button>
      <Link
        href="/account/wishlist"
        className={iconBtn}
        style={{ color: iconColor }}
        aria-label="Wishlist"
      >
        <Heart className={iconClassName} strokeWidth={1.5} />
      </Link>
      <button
        type="button"
        onClick={onAccountClick}
        className={iconBtn}
        style={{ color: iconColor }}
        aria-label="Account"
      >
        <User className={iconClassName} strokeWidth={1.5} />
      </button>
      <ThemeToggle
        color={iconColor}
        className="relative flex h-8 w-8 items-center justify-center transition-colors duration-200 hover:opacity-80"
      />
      <button
        type="button"
        onClick={openCart}
        className={cn("relative", iconBtn)}
        style={{ color: iconColor }}
        aria-label="Cart"
      >
        <ShoppingBag className={iconClassName} strokeWidth={1.5} />
        {totalItems > 0 ? (
          <span
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center px-1 font-sans text-[9px] font-semibold"
            style={{ backgroundColor: cartBadgeBg, color: cartBadgeFg }}
          >
            {totalItems > 9 ? "9+" : totalItems}
          </span>
        ) : null}
      </button>
    </div>
  );
}

export function Navbar({
  showAnnouncement = true,
  announcementMessages = ["WORLDWIDE SHIPPING · ₦ · $ · £"],
  announcementIntervalMs = 3000,
}: {
  showAnnouncement?: boolean;
  announcementMessages?: string[];
  announcementIntervalMs?: number;
}) {
  const pathname = usePathname();
  const subBrand = getSubBrand(pathname);
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionNav[]>([]);
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
      {showAnnouncement ? (
        <AnnouncementBar messages={announcementMessages} intervalMs={announcementIntervalMs} />
      ) : null}

      <header className="sticky top-0 z-50">
        <div className="overflow-hidden border-b border-sand/40 bg-ivory">
          <div className="mx-auto flex h-14 max-w-site items-center justify-between gap-2 px-3 sm:px-4 lg:h-[72px] lg:justify-center lg:px-10">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <button
                type="button"
                className="shrink-0 text-choc"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Logo variant="dark" size="sm" subBrand={subBrand} className="min-w-0 max-w-[120px] shrink sm:max-w-[140px]" />
            </div>

            <div className="hidden min-w-0 lg:flex lg:flex-none">
              <Logo variant="dark" size="md" subBrand={subBrand} className="shrink-0" />
            </div>

            <HeaderUtilityIcons
              className="lg:hidden"
              iconColor="var(--choc)"
              cartBadgeBg="var(--choc)"
              cartBadgeFg="var(--cream)"
              iconClassName="h-[16px] w-[16px] sm:h-[17px] sm:w-[17px]"
              gapClassName="gap-2 sm:gap-2.5"
              onAccountClick={handleAccountClick}
            />
          </div>
        </div>

        <div className="hidden border-b border-sand/20 bg-sidebar-bg lg:block">
          <div className="mx-auto grid h-12 max-w-site grid-cols-[1fr_auto] items-center gap-4 px-10">
            <nav className="flex min-w-0 items-center gap-6 xl:gap-8" aria-label="Primary">
              <NavLink href="/shop" label="Shop" />
              <RtwDropdown collections={collections} />
              {PRIMARY_LINKS.filter((l) => l.href !== "/shop").map((link) => (
                <NavLink key={link.href} href={link.href} label={link.label} />
              ))}
            </nav>

            <HeaderUtilityIcons
              iconColor="var(--cream)"
              cartBadgeBg="var(--cream)"
              cartBadgeFg="var(--sidebar-bg)"
              onAccountClick={handleAccountClick}
            />
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
