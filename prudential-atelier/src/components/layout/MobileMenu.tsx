"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/SocialIcons";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CurrencySwitcher } from "@/components/common/CurrencySwitcher";
import { useCartStore } from "@/store/cartStore";

const NAV_LINKS = [
  { label: "Shop", href: "/shop" },
  { label: "Bespoke", href: "/bespoke" },
  { label: "Consultation", href: "/consultation" },
  { label: "Our Story", href: "/our-story" },
  { label: "Press", href: "/press" },
];

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const { data: session } = useSession();
  const openSearch = useCartStore((s) => s.openSearch);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 flex flex-col bg-charcoal"
        >
          <div className="flex items-center justify-between border-b border-charcoal-mid px-6 py-5">
            <span className="font-display text-lg uppercase tracking-[0.1em] text-ivory">
              Prudential Atelier
            </span>
            <button type="button" onClick={onClose} className="p-2 text-ivory/60 hover:text-ivory">
              <X size={22} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col justify-center gap-1 px-8">
            {NAV_LINKS.map((link, i) => (
              <motion.div
                key={link.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.1, duration: 0.35 }}
              >
                <Link
                  href={link.href}
                  onClick={onClose}
                  className="block py-4 font-display text-3xl text-ivory/80 transition-all duration-200 hover:pl-2 hover:text-ivory"
                >
                  {link.label}
                </Link>
              </motion.div>
            ))}

            <div className="my-4 h-px bg-charcoal-mid" />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex flex-col gap-3"
            >
              <Link
                href={session ? "/account" : "/auth/login"}
                onClick={onClose}
                className="font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60 transition-colors hover:text-gold"
              >
                {session ? "My Account" : "Sign In / Register"}
              </Link>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openSearch();
                }}
                className="text-left font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60 transition-colors hover:text-gold"
              >
                Search
              </button>
              <Link
                href="/account/wishlist"
                onClick={onClose}
                className="font-label text-[12px] uppercase tracking-[0.15em] text-ivory/60 transition-colors hover:text-gold"
              >
                Wishlist
              </Link>
              <a
                href="https://pfacademy.ng"
                target="_blank"
                rel="noopener noreferrer"
                className="font-label text-[12px] uppercase tracking-[0.15em] text-gold transition-colors hover:text-gold-hover"
              >
                Fashion Academy ↗
              </a>
            </motion.div>

            <div className="mt-8">
              <CurrencySwitcher />
            </div>
          </nav>

          <div className="flex items-center gap-4 border-t border-charcoal-mid px-8 py-6">
            <a
              href="https://instagram.com/prudent_gabriel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ivory/40 transition-colors hover:text-gold"
            >
              <InstagramIcon size={18} />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ivory/40 transition-colors hover:text-gold"
            >
              <FacebookIcon size={18} />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
