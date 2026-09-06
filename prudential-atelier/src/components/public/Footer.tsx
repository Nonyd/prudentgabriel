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
  { label: "The Atelier", url: "/atelier" },
  { label: "Ready-to-Wear", url: "/rtw" },
  { label: "Bridal", url: "/bridal" },
  { label: "Kids", url: "/kids" },
  { label: "Careers", url: "/careers" },
  { label: "Fashion Academy", url: "/about#academy" },
  { label: "Journal", url: "/journal" },
];

const DEFAULT_CLIENT_LINKS: LinkItem[] = [
  { label: "Size Guide", url: "/size-guide" },
  { label: "Shipping & Returns", url: "/returns-policy" },
  { label: "Book Consultation", url: "/consultation" },
  { label: "Contact", url: "/contact" },
];

const LEGAL_LINKS = [
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/cookie-policy", label: "Cookie Policy" },
  { href: "/returns-policy", label: "Returns Policy" },
  { href: "/shipping-policy", label: "Shipping Policy" },
] as const;

const HOUSE_TAGLINE =
  "International luxury couture. Bespoke, ready-to-wear and bridal, made with love in Lagos for the world.";

const labelStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: "13px",
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

export function Footer({
  cms = {},
}: {
  cms?: Record<string, string>;
}) {
  const settings = usePublicSettings();
  const openCookieModal = useCookieConsentStore((s) => s.openModal);

  const instagramHandle = getSettingFromPublic(settings, "social_instagram", "@prudent_gabriel");
  const instagramUrl = instagramHandleToUrl(instagramHandle);
  const tiktokUrl = tiktokHandleToUrl(getSettingFromPublic(settings, "social_tiktok", "@prudentgabriel"));
  const facebookUrl = facebookHandleToUrl(getSettingFromPublic(settings, "social_facebook", "prudentgabriel"));
  const whatsappUrl = whatsappNumberToUrl(getSettingFromPublic(settings, "social_whatsapp", ""));

  const houseLinks = filterStorefrontLinks(
    cmsJson<LinkItem[]>(cms, "footer_house_links", DEFAULT_HOUSE_LINKS).map((l) => ({
      href: l.url,
      label: l.label,
      external: l.url.startsWith("http"),
    })),
  );

  const clientLinks = filterStorefrontLinks(
    cmsJson<LinkItem[]>(cms, "footer_client_links", DEFAULT_CLIENT_LINKS).map((l) => ({
      href: l.url,
      label: l.label,
      external: l.url.startsWith("http"),
    })),
  );

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
      <div className="glass-1 glass-panel mx-auto max-w-site overflow-hidden">
      <div className="px-6 pt-14 pb-12 text-center lg:px-10">
        <Logo variant="dark" size="lg" themeAdaptive={false} className="mx-auto inline-block" />
      </div>

      <div className="grid gap-12 px-6 pb-16 md:grid-cols-3 lg:px-10 lg:gap-16">
        <div className="min-w-0">
          <p className="mb-4" style={labelStyle}>
            The House
          </p>
          <p
            className="mb-5 max-w-[220px]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--text-mid)",
            }}
          >
            {HOUSE_TAGLINE}
          </p>

          <div className="-ml-2 mb-6 flex items-center">
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

          <FooterLinks links={houseLinks} />
        </div>

        <div className="min-w-0">
          <p className="mb-4" style={labelStyle}>
            Client Care
          </p>
          <FooterLinks links={clientLinks} />
        </div>

        <FooterNewsletter headline={newsletterHeadline} placeholder={newsletterPlaceholder} />
      </div>

      <div className="border-t border-[var(--glass-edge)] py-5">
        <div className="flex flex-col gap-4 px-6 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                color: "var(--text-light)",
              }}
            >
              {copyright}
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
            className="text-center"
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

          <p
            className="text-center italic"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              color: "var(--text-light)",
            }}
          >
            Developed with love by SonsHub Media Ltd
          </p>
        </div>
      </div>
      </div>
    </footer>
  );
}
