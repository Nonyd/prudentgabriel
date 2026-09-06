"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons/SocialIcons";
import { PaymentMarks } from "@/components/icons/PaymentMarks";
import { FooterNewsletter } from "./FooterNewsletter";
import { Logo } from "@/components/ui/Logo";
import { usePublicSettings, getSettingFromPublic } from "@/hooks/usePublicSettings";
import { cmsGet, cmsJson } from "@/lib/cms-helpers";
import { instagramHandleToUrl } from "@/lib/sub-brand";
import { useCookieConsentStore } from "@/store/cookieConsentStore";
import { filterStorefrontLinks } from "@/lib/atelier-storefront";

type LinkItem = { label: string; url: string };

const DEFAULT_HOUSE_LINKS: LinkItem[] = [
  { label: "The atelier", url: "/atelier" },
  { label: "Bridal", url: "/bridal" },
  { label: "Fashion Academy", url: "/about#academy" },
  { label: "Journal", url: "/journal" },
  { label: "About", url: "/about" },
  { label: "Careers", url: "/careers" },
];

const DEFAULT_SHOP_LINKS: LinkItem[] = [
  { label: "Ready to wear", url: "/rtw" },
  { label: "New arrivals", url: "/rtw?sort=newest" },
  { label: "Collections", url: "/collections" },
  { label: "Accessories", url: "/shop?category=ACCESSORIES" },
  { label: "Kids", url: "/kids" },
];

const DEFAULT_CLIENT_LINKS: LinkItem[] = [
  { label: "Size guide", url: "/size-guide" },
  { label: "Shipping and returns", url: "/returns-policy" },
  { label: "Book a consultation", url: "/consultation" },
  { label: "Contact", url: "/contact" },
];

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/returns-policy", label: "Returns Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
] as const;

const headingStyle = {
  fontFamily: "var(--font-display)",
  fontSize: "18px",
  fontWeight: 400,
  color: "var(--text-primary)",
} as const;

const linkStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: "13px",
  fontWeight: 300,
  lineHeight: 2.2,
  color: "var(--text-mid)",
} as const;

function tiktokHandleToUrl(handle: string): string {
  const username = handle.replace(/^@/, "").trim();
  return username ? `https://tiktok.com/@${username}` : "";
}

function facebookHandleToUrl(handle: string): string {
  const page = handle.replace(/^@/, "").trim();
  return page ? `https://facebook.com/${page}` : "";
}

function whatsappNumberToUrl(number: string): string {
  const digits = number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

function SocialIconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center text-text-mid transition-colors duration-200 hover:text-choc"
    >
      {children}
    </a>
  );
}

function FooterLinks({
  links,
}: {
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <ul>
      {links.map((link) => (
        <li key={link.label}>
          {link.external ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-choc"
              style={linkStyle}
            >
              {link.label}
            </a>
          ) : (
            <Link href={link.href} className="transition-colors hover:text-choc" style={linkStyle}>
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function mapCmsLinks(items: LinkItem[]) {
  return filterStorefrontLinks(
    items.map((l) => ({
      href: l.url,
      label: l.label,
      external: l.url.startsWith("http"),
    })),
  );
}

export function Footer({
  cms = {},
}: {
  cms?: Record<string, string>;
}) {
  const settings = usePublicSettings();
  const openCookieModal = useCookieConsentStore((s) => s.openModal);

  const instagramHandle = getSettingFromPublic(settings, "social_instagram", "@the_prudentgabriel");
  const instagramUrl = instagramHandleToUrl(instagramHandle);
  const tiktokUrl = tiktokHandleToUrl(getSettingFromPublic(settings, "social_tiktok", "@prudentgabriel"));
  const facebookUrl = facebookHandleToUrl(getSettingFromPublic(settings, "social_facebook", "prudentgabriel"));
  const whatsappUrl = whatsappNumberToUrl(getSettingFromPublic(settings, "social_whatsapp", ""));

  const houseLinks = mapCmsLinks(cmsJson<LinkItem[]>(cms, "footer_house_links", DEFAULT_HOUSE_LINKS));
  const shopLinks = mapCmsLinks(cmsJson<LinkItem[]>(cms, "footer_shop_links", DEFAULT_SHOP_LINKS));
  const clientLinks = mapCmsLinks(cmsJson<LinkItem[]>(cms, "footer_client_links", DEFAULT_CLIENT_LINKS));

  const copyright = cmsGet(
    cms,
    "footer_copyright",
    `© ${new Date().getFullYear()} Prudential Atelier. All rights reserved.`,
  );

  const newsletterHeadline = cmsGet(
    cms,
    "footer_newsletter_headline",
    "New collections and atelier notes, first.",
  );
  const newsletterPlaceholder = cmsGet(cms, "footer_newsletter_placeholder", "Your email");

  return (
    <footer className="px-3 pb-3">
      <div className="mx-auto max-w-site px-6 pb-6 pt-8 lg:px-10">
        <Logo variant="dark" size="lg" themeAdaptive={false} />
      </div>

      <div className="glass-1 glass-panel mx-auto max-w-site overflow-hidden">
        <div
          data-footer-columns=""
          className="grid grid-cols-2 gap-x-8 gap-y-12 px-6 pb-12 pt-12 lg:grid-cols-4 lg:gap-12 lg:px-10"
        >
          <div className="min-w-0">
            <p className="mb-4" style={headingStyle}>
              The house
            </p>
            <FooterLinks links={houseLinks} />
          </div>

          <div className="min-w-0">
            <p className="mb-4" style={headingStyle}>
              Shop
            </p>
            <FooterLinks links={shopLinks} />
          </div>

          <div className="min-w-0">
            <p className="mb-4" style={headingStyle}>
              Client care
            </p>
            <FooterLinks links={clientLinks} />
          </div>

          <div className="col-span-2 min-w-0 lg:col-span-1" data-footer-stay-close="">
            <FooterNewsletter headline={newsletterHeadline} placeholder={newsletterPlaceholder} />
            <div className="-ml-2 mt-4 flex flex-wrap items-center">
              <SocialIconLink href={instagramUrl} label="Instagram">
                <InstagramIcon size={16} />
              </SocialIconLink>
              <SocialIconLink href={tiktokUrl} label="TikTok">
                <TikTokIcon size={16} />
              </SocialIconLink>
              <SocialIconLink href={facebookUrl} label="Facebook">
                <FacebookIcon size={16} />
              </SocialIconLink>
              <SocialIconLink href={whatsappUrl || "/contact"} label="WhatsApp">
                <WhatsAppIcon size={16} />
              </SocialIconLink>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--glass-edge)] py-5">
          <div className="flex flex-col gap-3 px-6 lg:px-10">
            <div
              data-footer-legal=""
              className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center sm:gap-6"
            >
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: "var(--text-light)",
                }}
              >
                {copyright}
                {" "}
                <span>
                  Developed with love by SonsHub Media Ltd
                </span>
              </p>
              <PaymentMarks className="flex items-center gap-1.5 text-text-mid" />
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-choc"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "11px",
                  color: "var(--text-mid)",
                }}
              >
                {instagramHandle}
              </a>
            </div>

            <p
              className="text-left"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "12px",
                color: "var(--text-light)",
              }}
            >
              {LEGAL_LINKS.map((link, i) => (
                <span key={link.href}>
                  {i > 0 ? " · " : null}
                  <Link href={link.href} className="transition-colors hover:text-choc">
                    {link.label}
                  </Link>
                </span>
              ))}
              {" · "}
              <button type="button" onClick={openCookieModal} className="transition-colors hover:text-choc">
                Cookie Settings
              </button>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
