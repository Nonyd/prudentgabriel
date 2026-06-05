"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FooterNewsletter } from "./FooterNewsletter";
import { Logo } from "@/components/ui/Logo";
import { usePublicSettings, getSettingFromPublic } from "@/hooks/usePublicSettings";
import { cmsGet, cmsJson } from "@/lib/cms-helpers";
import {
  getInstagramFallback,
  getInstagramSettingKey,
  getSubBrand,
  instagramHandleToUrl,
} from "@/lib/sub-brand";
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

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p
        className="mb-4 uppercase"
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.2em",
          color: "var(--lightbr)",
        }}
      >
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
                className="font-light transition-colors hover:text-cream"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  color: "rgba(226, 209, 194, 0.75)",
                }}
              >
                {link.label}
              </a>
            ) : (
              <Link
                href={link.href}
                className="font-light transition-colors hover:text-cream"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  color: "rgba(226, 209, 194, 0.75)",
                }}
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

export function Footer({ cms = {} }: { cms?: Record<string, string> }) {
  const pathname = usePathname();
  const subBrand = getSubBrand(pathname);
  const settings = usePublicSettings();
  const openCookieModal = useCookieConsentStore((s) => s.openModal);
  const instagramKey = getInstagramSettingKey(subBrand);
  const instagramHandle = getSettingFromPublic(settings, instagramKey, getInstagramFallback(subBrand));
  const instagramUrl = instagramHandleToUrl(instagramHandle);

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

  const copyright = cmsGet(cms, "footer_copyright", `© ${new Date().getFullYear()} Prudential Atelier. All rights reserved.`);

  const newsletterHeadline = cmsGet(
    cms,
    "footer_newsletter_headline",
    "Collections, ateliers and invitations — first.",
  );
  const newsletterPlaceholder = cmsGet(cms, "footer_newsletter_placeholder", "Your email");

  return (
    <footer className="bg-footer-bg">
      <div className="mx-auto max-w-site px-6 py-16 lg:px-10 lg:py-20">
        <div className="flex justify-center pb-12">
          <Logo variant="white" size="lg" themeAdaptive={false} showSubline subBrand={subBrand} />
        </div>

        <div className="grid gap-10 md:grid-cols-3 lg:gap-12">
          <FooterColumn title="The House" links={houseLinks} />
          <FooterColumn title="Client Care" links={clientLinks} />
          <FooterNewsletter headline={newsletterHeadline} placeholder={newsletterPlaceholder} />
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(226, 209, 194, 0.1)" }}>
        <div className="mx-auto flex max-w-site flex-col gap-3 px-6 py-6 lg:px-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "rgba(226, 209, 194, 0.4)",
              }}
            >
              {copyright}
            </p>
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-cream/80"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "rgba(226, 209, 194, 0.55)",
              }}
            >
              {instagramHandle} ↗
            </a>
          </div>

          <p
            className="text-center"
            style={{
              fontFamily: "var(--font-jost)",
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
            <button
              type="button"
              onClick={openCookieModal}
              className="transition-colors hover:text-cream"
            >
              Cookie Settings
            </button>
          </p>

          <p
            className="text-center italic"
            style={{
              fontFamily: "var(--font-body)",
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
