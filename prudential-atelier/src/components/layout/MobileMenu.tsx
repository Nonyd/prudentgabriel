"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BrandLogo } from "@/components/common/BrandLogo";
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/icons/SocialIcons";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
import { DarkModeToggle } from "@/components/common/DarkModeToggle";
import { useCartStore } from "@/store/cartStore";
import { useThemeStore } from "@/store/themeStore";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Atelier", href: "/atelier" },
  { label: "Bridal", href: "/bridal" },
  { label: "Kids", href: "/kids" },
  { label: "Ready to Wear", href: "/rtw" },
  { label: "Book a Consultation", href: "/consultation" },
];

const RTW_SUBLINKS = [
  { label: "All Ready to Wear", href: "/rtw" },
  { label: "New Arrivals", href: "/rtw?sort=newest" },
  { label: "Dresses", href: "/rtw?tags=dress" },
  { label: "Jumpsuits", href: "/rtw?tags=jumpsuit" },
  { label: "Sets", href: "/rtw?tags=set" },
  { label: "Suits", href: "/rtw?tags=suit" },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { data: session } = useSession();
  const openSearch = useCartStore((s) => s.openSearch);
  const openCart = useCartStore((s) => s.openCart);
  const isDark = useThemeStore((s) => s.isDark);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--white)]"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-mid-grey px-6 py-4">
            <Link href="/" onClick={onClose} className="relative block h-11 w-11">
              <BrandLogo width={44} height={44} />
            </Link>
            <button type="button" onClick={onClose} className="p-2 text-olive" aria-label="Close menu">
              <X size={22} strokeWidth={1.5} />
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto px-8 pb-8 pt-10">
            {NAV_LINKS.map((link, i) => (
              <motion.div
                key={link.href + link.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 + 0.05, duration: 0.45, ease: [0, 0, 0.2, 1] }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-3 font-display text-[32px] italic leading-tight text-charcoal"
                >
                  {link.label}
                </Link>
                {link.label === "Ready to Wear" && (
                  <ul className="mb-2 ml-1 space-y-2 border-l border-mid-grey pl-4">
                    {RTW_SUBLINKS.map((s) => (
                      <li key={s.href + s.label}>
                        <Link
                          href={s.href}
                          onClick={onClose}
                          className="font-body text-[13px] font-medium uppercase tracking-[0.1em] text-dark-grey hover:text-olive"
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="my-6 h-px bg-mid-grey"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col gap-4"
            >
              <Link
                href={session ? "/account" : "/auth/login"}
                onClick={onClose}
                className="font-body text-[13px] font-medium uppercase tracking-[0.12em] text-charcoal"
              >
                Account
              </Link>
              <Link
                href="/account/wishlist"
                onClick={onClose}
                className="font-body text-[13px] font-medium uppercase tracking-[0.12em] text-charcoal"
              >
                Wishlist
              </Link>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSearch();
                }}
                className="text-left font-body text-[13px] font-medium uppercase tracking-[0.12em] text-charcoal"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openCart();
                }}
                className="text-left font-body text-[13px] font-medium uppercase tracking-[0.12em] text-charcoal"
              >
                Cart
              </button>
            </motion.div>
          </nav>

          <div className="flex shrink-0 items-center justify-between border-t border-mid-grey px-6 py-4">
            <span className="font-body text-sm uppercase tracking-widest text-dark-grey">
              {isDark ? "Dark Mode" : "Light Mode"}
            </span>
            <DarkModeToggle />
          </div>

          <div className="shrink-0 border-t border-mid-grey px-8 py-6">
            <p className="mb-4 font-body text-[11px] uppercase tracking-[0.15em] text-dark-grey">Currency</p>
            <CurrencySwitcher variant="compact-pills" />
            <div className="mt-8 flex items-center justify-between">
              <span className="font-body text-[12px] text-charcoal">@the_prudentgabriel</span>
              <div className="flex items-center gap-4 text-charcoal">
                <a href="https://instagram.com/the_prudentgabriel" target="_blank" rel="noopener noreferrer" className="hover:text-olive">
                  <InstagramIcon size={18} />
                </a>
                <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:text-olive">
                  <TikTokIcon size={18} />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-olive">
                  <FacebookIcon size={18} />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-olive">
                  <YouTubeIcon size={18} />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
