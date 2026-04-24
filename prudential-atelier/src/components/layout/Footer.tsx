import Link from "next/link";
import { BrandLogo } from "@/components/common/BrandLogo";
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from "@/components/icons/SocialIcons";

const SHOP_LINKS = [
  { label: "New Arrivals", href: "/shop?newArrival=true" },
  { label: "Ready to Wear", href: "/shop" },
  { label: "Prudential Bride", href: "/shop?category=BRIDAL" },
  { label: "Bespoke", href: "/bespoke" },
  { label: "Sale", href: "/shop?sale=true" },
];

const COMPANY_LINKS: { label: string; href: string; external?: boolean }[] = [
  { label: "Our Story", href: "/our-story" },
  { label: "Press", href: "/press" },
  { label: "Careers", href: "/contact" },
  { label: "Contact", href: "/contact" },
  { label: "PFA Academy ↗", href: "https://pfacademy.ng", external: true },
];

const CONSULT_LINKS = [
  { label: "Book a Consultation", href: "/consultation" },
  { label: "Style Session", href: "/consultation" },
  { label: "Bridal Consult", href: "/consultation" },
  { label: "Home Visit", href: "/consultation" },
];

export function Footer({
  tagline = "Lagos, Nigeria",
  copyrightLine,
}: {
  tagline?: string;
  copyrightLine?: string;
}) {
  const copy =
    copyrightLine ?? `© ${new Date().getFullYear()} Prudent Gabriel. All Rights Reserved.`;
  return (
    <footer className="bg-black text-white/60">
      <div className="h-0.5 w-full bg-olive" />

      <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-8 lg:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-3 lg:grid-cols-5 lg:gap-8">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="inline-block">
              <BrandLogo width={36} height={36} variant="onDark" />
            </Link>
            <p className="mt-4 font-body text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Prudent Gabriel</p>
            <p className="mt-1 font-body text-[12px] font-light text-white/30">{tagline}</p>
            <div className="mt-6 flex items-center gap-4 text-white/50">
              <a href="https://instagram.com/prudent_gabriel" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <InstagramIcon size={18} />
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <TikTokIcon size={18} />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <FacebookIcon size={18} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
                <YouTubeIcon size={18} />
              </a>
            </div>
          </div>

          <div>
            <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Shop</p>
            <ul className="space-y-2">
              {SHOP_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="font-body text-[13px] font-light leading-loose text-white/60 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Company</p>
            <ul className="space-y-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-[13px] font-light leading-loose text-white/60 hover:text-white"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="font-body text-[13px] font-light leading-loose text-white/60 hover:text-white">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Consultations</p>
            <ul className="space-y-2">
              {CONSULT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="font-body text-[13px] font-light leading-loose text-white/60 hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <p className="mb-4 font-body text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Newsletter</p>
            <p className="mb-3 max-w-xs font-body text-[12px] font-light text-white/50">
              Subscribe for early access and atelier stories.
            </p>
            <div className="flex max-w-xs border-b border-white/20">
              <input
                type="email"
                placeholder="Email"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 font-body text-[12px] text-white placeholder:text-white/30 focus:outline-none"
              />
              <button type="button" className="shrink-0 px-2 font-body text-lg text-white/70 hover:text-white" aria-label="Subscribe">
                →
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 border-t border-white/10 pt-6">
          <div className="flex w-full flex-col items-center justify-between gap-4 md:flex-row">
            <p className="font-body text-[11px] text-white/25">{copy}</p>
            <div className="flex flex-wrap items-center justify-center gap-6">
              {(
                [
                  ["Privacy Policy", "/legal/privacy"],
                  ["Terms", "/legal/terms"],
                  ["Returns", "/legal/returns"],
                ] as const
              ).map(([label, href]) => (
                <Link key={href} href={href} className="font-body text-[11px] text-white/25 transition-colors hover:text-white/60">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <p className="font-body text-[11px] text-white/25">
            Designed with love by{" "}
            <a
              href="https://sonshubmedia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 underline-offset-2 transition-colors hover:text-white/70 hover:underline"
            >
              SonsHub Media
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
