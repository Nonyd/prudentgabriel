import Link from "next/link";
import { FacebookIcon, InstagramIcon } from "@/components/icons/SocialIcons";

const SHOP_LINKS = [
  { label: "New Arrivals", href: "/shop?filter=newArrival" },
  { label: "RTW Collection", href: "/shop?type=RTW" },
  { label: "Bespoke Couture", href: "/bespoke" },
  { label: "Book Consultation", href: "/consultation" },
  { label: "Bridal", href: "/shop?category=BRIDAL" },
];

const COMPANY_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Our Story", href: "/our-story" },
  { label: "Press", href: "/press" },
  { label: "Contact Us", href: "/contact" },
  { label: "PFA Academy ↗", href: "https://pfacademy.ng", external: true },
];

export function Footer() {
  return (
    <footer className="bg-charcoal text-ivory/70">
      <div className="h-px w-full bg-gold/30" />

      <div className="mx-auto max-w-site px-6 py-16 lg:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-16">
          <div className="lg:col-span-1">
            <p className="mb-4 font-display text-xl uppercase tracking-[0.1em] text-ivory">Prudential Atelier</p>
            <p className="mb-6 font-body text-sm leading-relaxed text-ivory/60">
              Luxury Nigerian fashion for the woman who commands every room.
            </p>
            <div className="flex items-center gap-4">
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
          </div>

          <div>
            <p className="mb-4 font-label text-[11px] uppercase tracking-[0.18em] text-gold">Shop</p>
            <ul className="space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-body text-sm text-ivory/60 transition-colors hover:text-ivory"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 font-label text-[11px] uppercase tracking-[0.18em] text-gold">Company</p>
            <ul className="space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-sm text-ivory/60 transition-colors hover:text-gold"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="font-body text-sm text-ivory/60 transition-colors hover:text-ivory"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 font-label text-[11px] uppercase tracking-[0.18em] text-gold">Inner Circle</p>
            <p className="mb-4 font-display text-lg italic text-ivory">&quot;Join the Atelier Community&quot;</p>
            <p className="mb-4 font-body text-xs text-ivory/50">
              Early access to collections, exclusive offers, and stories from the atelier.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 rounded-sm border border-charcoal-mid bg-charcoal-mid px-3 py-2 font-body text-sm text-ivory outline-none transition-colors placeholder:text-ivory/30 focus:border-gold"
              />
              <button
                type="button"
                className="rounded-sm bg-gold px-4 py-2 font-label text-[11px] uppercase tracking-[0.1em] text-charcoal transition-colors hover:bg-gold-hover"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-charcoal-mid pt-8 md:flex-row">
          <p className="font-body text-xs text-ivory/40">
            © {new Date().getFullYear()} Prudential Atelier · All Rights Reserved
          </p>
          <div className="flex items-center gap-6">
            {(
              [
                ["Privacy Policy", "/legal/privacy"],
                ["Terms", "/legal/terms"],
                ["Returns", "/legal/returns"],
              ] as const
            ).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="font-body text-xs text-ivory/40 transition-colors hover:text-ivory/70"
              >
                {label}
              </Link>
            ))}
          </div>
          <p className="font-body text-xs text-ivory/30">Made with ♡ in Lagos</p>
        </div>
      </div>
    </footer>
  );
}
