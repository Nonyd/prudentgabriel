import Link from "next/link";
import { InstagramIcon, PinterestIcon, TikTokIcon } from "@/components/icons/SocialIcons";
import { FooterNewsletter } from "./FooterNewsletter";

const HOUSE_LINKS = [
  { href: "/atelier", label: "The Atelier" },
  { href: "/bespoke", label: "Bespoke Process" },
  { href: "/bridal", label: "Bridal" },
  { href: "https://pfacademy.ng", label: "Fashion Academy", external: true },
  { href: "/journal", label: "Journal" },
];

const CLIENT_LINKS = [
  { href: "/account/orders", label: "Track Your Order" },
  { href: "/rtw", label: "Size Guide" },
  { href: "/legal/returns", label: "Shipping & Returns" },
  { href: "/consultation", label: "Book Consultation" },
  { href: "/contact", label: "Contact" },
];

function BrandWordmark() {
  return (
    <Link href="/" className="group inline-block">
      <span className="block font-serif text-[clamp(1.5rem,2.5vw,2rem)] font-medium uppercase tracking-[0.28em] text-cream transition-colors group-hover:text-sand">
        Prudential
      </span>
      <span className="mt-1 block font-sans text-[9px] font-medium uppercase tracking-[0.38em] text-sand/80">
        Atelier
      </span>
    </Link>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr/80">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-[13px] font-light text-cream/75 transition-colors hover:text-cream"
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="font-sans text-[13px] font-light text-cream/75 transition-colors hover:text-cream"
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer-dark text-sand">
      <div className="mx-auto grid max-w-site gap-12 px-6 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-10 lg:px-10 lg:py-20">
        <div>
          <BrandWordmark />
          <p className="mt-6 max-w-sm font-sans text-[13px] font-light leading-relaxed text-cream/70">
            International luxury couture. Bespoke, ready-to-wear and bridal, made with love in
            Lagos for the world.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <a
              href="https://instagram.com/prudent_gabriel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sand transition-colors hover:text-cream"
              aria-label="Instagram"
            >
              <InstagramIcon size={16} className="h-4 w-4" />
            </a>
            <a
              href="https://pinterest.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sand transition-colors hover:text-cream"
              aria-label="Pinterest"
            >
              <PinterestIcon size={16} className="h-4 w-4" />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sand transition-colors hover:text-cream"
              aria-label="TikTok"
            >
              <TikTokIcon size={16} className="h-4 w-4" />
            </a>
          </div>
        </div>

        <FooterColumn title="The House" links={HOUSE_LINKS} />
        <FooterColumn title="Client Care" links={CLIENT_LINKS} />
        <FooterNewsletter />
      </div>

      <div className="border-t border-cream/10">
        <div className="mx-auto flex max-w-site flex-col gap-3 px-6 py-6 lg:px-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-[11px] text-cream/40">
              © {year} Prudential Atelier. All rights reserved.
            </p>
            <p className="font-sans text-[11px] text-cream/40">
              <Link href="/legal/privacy" className="transition-colors hover:text-cream/60">
                Privacy
              </Link>
              {" · "}
              <Link href="/legal/terms" className="transition-colors hover:text-cream/60">
                Terms
              </Link>
              {" · ₦ NGN"}
            </p>
          </div>
          <p className="text-center font-sans text-[10px] italic text-lightbr/60">
            Developed with love by SonsHub Media Ltd
          </p>
        </div>
      </div>
    </footer>
  );
}
