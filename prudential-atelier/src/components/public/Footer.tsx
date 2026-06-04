import Link from "next/link";
import { FacebookIcon, InstagramIcon } from "@/components/icons/SocialIcons";

const SHOP_LINKS = [
  { href: "/shop", label: "Ready to Wear" },
  { href: "/bridal", label: "Bridal" },
  { href: "/kids", label: "Kids" },
  { href: "/shop", label: "Accessories" },
];

const ATELIER_LINKS = [
  { href: "/bespoke", label: "Bespoke Couture" },
  { href: "/consultation", label: "Book Consultation" },
  { href: "/our-story", label: "Our Story" },
  { href: "/journal", label: "Journal" },
];

const CLIENT_LINKS = [
  { href: "/account", label: "My Account" },
  { href: "/account/orders", label: "Orders" },
  { href: "/track", label: "Track Order" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-choc text-sand">
      <div className="mx-auto grid max-w-site gap-10 px-6 py-16 lg:grid-cols-4 lg:px-10">
        <div>
          <p className="font-serif text-xl font-medium tracking-[0.12em]">
            <span className="text-cream">Prudent</span>{" "}
            <span className="text-lightbr">Gabriel</span>
          </p>
          <p className="mt-4 max-w-xs font-sans text-[13px] font-light leading-relaxed text-cream/80">
            Luxury Nigerian fashion — bespoke couture and ready-to-wear for the woman who commands
            every room.
          </p>
          <div className="mt-6 flex gap-4">
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
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sand transition-colors hover:text-cream"
              aria-label="Facebook"
            >
              <FacebookIcon size={16} className="h-4 w-4" />
            </a>
            <a
              href="https://tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[10px] font-semibold uppercase tracking-wider text-sand hover:text-cream"
            >
              TikTok
            </a>
            <a
              href="https://wa.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[10px] font-semibold uppercase tracking-wider text-sand hover:text-cream"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <FooterColumn title="Shop" links={SHOP_LINKS} />
        <FooterColumn title="Atelier" links={ATELIER_LINKS} />
        <FooterColumn title="Client" links={CLIENT_LINKS} />
      </div>

      <div className="border-t border-sand/20">
        <div className="mx-auto flex max-w-site flex-col gap-2 px-6 py-6 font-sans text-[10px] uppercase tracking-[0.12em] text-sand/70 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>© {year} Prudential Atelier. All rights reserved.</p>
          <p>Developed with love by SonsHub Media Ltd</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr/80">
        {title}
      </p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <Link
              href={link.href}
              className="font-sans text-[13px] font-light text-cream/75 transition-colors hover:text-cream"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
