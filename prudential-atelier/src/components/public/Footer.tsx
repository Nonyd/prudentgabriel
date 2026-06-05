"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FooterNewsletter } from "./FooterNewsletter";
import { Logo } from "@/components/ui/Logo";
import { usePublicSettings, getSettingFromPublic } from "@/hooks/usePublicSettings";
import {
  getInstagramFallback,
  getInstagramSettingKey,
  getSubBrand,
  instagramHandleToUrl,
} from "@/lib/sub-brand";

const HOUSE_LINKS = [
  { href: "/atelier", label: "The Atelier" },
  { href: "/rtw", label: "Ready-to-Wear" },
  { href: "/bridal", label: "Bridal" },
  { href: "/kids", label: "Kids" },
  { href: "/about#academy", label: "Fashion Academy" },
  { href: "/journal", label: "Journal" },
];

const CLIENT_LINKS = [
  { href: "/account/orders", label: "Track Your Order" },
  { href: "/rtw", label: "Size Guide" },
  { href: "/legal/returns", label: "Shipping & Returns" },
  { href: "/consultation", label: "Book Consultation" },
  { href: "/contact", label: "Contact" },
];

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

export function Footer() {
  const pathname = usePathname();
  const subBrand = getSubBrand(pathname);
  const settings = usePublicSettings();
  const instagramKey = getInstagramSettingKey(subBrand);
  const instagramHandle = getSettingFromPublic(settings, instagramKey, getInstagramFallback(subBrand));
  const instagramUrl = instagramHandleToUrl(instagramHandle);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer-bg">
      <div className="mx-auto max-w-site px-6 py-16 lg:px-10 lg:py-20">
        <div className="flex justify-center pb-12">
          <Logo variant="white" size="lg" themeAdaptive={false} showSubline subBrand={subBrand} />
        </div>

        <div className="grid gap-10 md:grid-cols-3 lg:gap-12">
          <FooterColumn title="The House" links={HOUSE_LINKS} />
          <FooterColumn title="Client Care" links={CLIENT_LINKS} />
          <FooterNewsletter />
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
              © {year} Prudential Atelier. All rights reserved.
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
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                color: "rgba(226, 209, 194, 0.4)",
              }}
            >
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
