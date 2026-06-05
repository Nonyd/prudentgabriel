"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/SocialIcons";
import { FooterNewsletter } from "./FooterNewsletter";
import { usePublicSettings, getSettingFromPublic } from "@/hooks/usePublicSettings";
import { cmsGet, cmsJson } from "@/lib/cms-helpers";
import { instagramHandleToUrl } from "@/lib/sub-brand";
import { useCookieConsentStore } from "@/store/cookieConsentStore";

type LinkItem = { label: string; url: string };

const DEFAULT_HOUSE_LINKS: LinkItem[] = [
  { label: "The Atelier", url: "/atelier" },
  { label: "Ready-to-Wear", url: "/rtw" },
  { label: "Bridal", url: "/bridal" },
  { label: "Kids", url: "/kids" },
  { label: "Fashion Academy", url: "/about#academy" },
  { label: "Journal", url: "/journal" },
];

const DEFAULT_CLIENT_LINKS: LinkItem[] = [
  { label: "Track Your Order", url: "/track" },
  { label: "Size Guide", url: "/rtw" },
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
  fontSize: "10px",
  fontWeight: 500,
  letterSpacing: "0.18em",
  color: "var(--lightbr)",
} as const;

const linkStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: "13px",
  fontWeight: 300,
  lineHeight: 2.2,
  color: "var(--sand)",
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
      className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:border-[rgba(226,209,194,0.5)]"
      style={{ border: "0.5px solid rgba(152, 117, 91, 0.3)" }}
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
              className="transition-colors hover:text-cream"
              style={linkStyle}
            >
              {link.label}
            </a>
          ) : (
            <Link href={link.href} className="transition-colors hover:text-cream" style={linkStyle}>
              {link.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Footer({ cms = {} }: { cms?: Record<string, string> }) {
  const settings = usePublicSettings();
  const openCookieModal = useCookieConsentStore((s) => s.openModal);

  const instagramHandle = getSettingFromPublic(settings, "social_instagram", "@prudent_gabriel");
  const instagramUrl = instagramHandleToUrl(instagramHandle);
  const tiktokUrl = tiktokHandleToUrl(getSettingFromPublic(settings, "social_tiktok", "@prudentgabriel"));
  const facebookUrl = facebookHandleToUrl(getSettingFromPublic(settings, "social_facebook", "prudentgabriel"));
  const whatsappUrl = whatsappNumberToUrl(getSettingFromPublic(settings, "social_whatsapp", ""));

  const houseLinks = cmsJson<LinkItem[]>(cms, "footer_house_links", DEFAULT_HOUSE_LINKS).map((l) => ({
    href: l.url,
    label: l.label,
    external: l.url.startsWith("http"),
  }));

  const clientLinks = cmsJson<LinkItem[]>(cms, "footer_client_links", DEFAULT_CLIENT_LINKS).map((l) => ({
    href: l.url,
    label: l.label,
    external: l.url.startsWith("http"),
  }));

  const copyright = cmsGet(
    cms,
    "footer_copyright",
    `© ${new Date().getFullYear()} Prudential Atelier. All rights reserved.`,
  );

  const newsletterHeadline = cmsGet(
    cms,
    "footer_newsletter_headline",
    "Collections, ateliers and invitations — first.",
  );
  const newsletterPlaceholder = cmsGet(cms, "footer_newsletter_placeholder", "Your email");

  return (
    <footer style={{ backgroundColor: "#1A0F08" }}>
      <div className="mx-auto max-w-site px-6 pt-14 pb-12 text-center lg:px-10">
        <Link href="/" className="inline-block">
          <span
            className="block uppercase"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              letterSpacing: "0.16em",
              color: "var(--cream)",
            }}
          >
            PRUDENTIAL
          </span>
          <span
            className="mt-1 block uppercase"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              letterSpacing: "0.3em",
              color: "var(--lightbr)",
            }}
          >
            / ATELIER
          </span>
        </Link>
      </div>

      <div className="mx-auto grid max-w-site gap-12 px-6 pb-16 md:grid-cols-3 lg:px-10 lg:gap-16">
        <div>
          <p className="mb-4 uppercase" style={labelStyle}>
            The House
          </p>
          <p
            className="mb-5 max-w-[220px]"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--sand)",
            }}
          >
            {HOUSE_TAGLINE}
          </p>

          <div className="mb-6 flex items-center gap-3">
            <SocialIconLink href={instagramUrl} label="Instagram">
              <InstagramIcon size={14} className="text-sand" />
            </SocialIconLink>
            <SocialIconLink href={tiktokUrl} label="TikTok">
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--sand)",
                  lineHeight: 1,
                }}
              >
                T
              </span>
            </SocialIconLink>
            <SocialIconLink href={facebookUrl} label="Facebook">
              <FacebookIcon size={14} className="text-sand" />
            </SocialIconLink>
            <SocialIconLink href={whatsappUrl || "/contact"} label="WhatsApp">
              <MessageCircle size={14} strokeWidth={1.5} className="text-sand" />
            </SocialIconLink>
          </div>

          <FooterLinks links={houseLinks} />
        </div>

        <div>
          <p className="mb-4 uppercase" style={labelStyle}>
            Client Care
          </p>
          <FooterLinks links={clientLinks} />
        </div>

        <FooterNewsletter headline={newsletterHeadline} placeholder={newsletterPlaceholder} />
      </div>

      <div style={{ backgroundColor: "rgba(0, 0, 0, 0.2)", padding: "20px 0" }}>
        <div className="mx-auto flex max-w-site flex-col gap-4 px-6 lg:px-10">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                color: "var(--text-light)",
              }}
            >
              {copyright}
            </p>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:opacity-80"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "11px",
                color: "var(--lightbr)",
              }}
            >
              {instagramHandle} ↗
            </a>
          </div>

          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              color: "var(--text-light)",
            }}
          >
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.href}>
                {i > 0 ? " · " : null}
                <Link href={link.href} className="transition-colors hover:text-cream">
                  {link.label}
                </Link>
              </span>
            ))}
            {" · "}
            <button type="button" onClick={openCookieModal} className="transition-colors hover:text-cream">
              Cookie Settings
            </button>
          </p>

          <p
            className="text-center italic"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "10px",
              color: "rgba(152, 117, 91, 0.5)",
            }}
          >
            Developed with love by SonsHub Media Ltd
          </p>
        </div>
      </div>
    </footer>
  );
}
