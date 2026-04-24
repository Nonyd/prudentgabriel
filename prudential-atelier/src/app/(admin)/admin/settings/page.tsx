import Link from "next/link";
import type { SettingGroup } from "@prisma/client";
import {
  Bell,
  CreditCard,
  Image as ImageIcon,
  Images,
  Mail,
  Package,
  Palette,
  Search,
  Share2,
  Star,
  Type,
} from "lucide-react";
import { prisma } from "@/lib/prisma";

const CARDS: {
  slug: string;
  title: string;
  description: string;
  icon: typeof Package;
  countGroups?: SettingGroup[];
  href: string;
  countKind?: "settings" | "images" | "media";
}[] = [
  {
    slug: "store",
    title: "Store",
    description: "Store name, contact, currency, shipping thresholds",
    icon: Package,
    countGroups: ["STORE"],
    href: "/admin/settings/store",
  },
  {
    slug: "appearance",
    title: "Appearance",
    description: "Site images, logo, favicon",
    icon: Palette,
    countGroups: ["APPEARANCE"],
    href: "/admin/settings/appearance",
  },
  {
    slug: "content",
    title: "Content",
    description: "Edit all text and copy across the website",
    icon: Type,
    countGroups: ["CONTENT"],
    href: "/admin/settings/content",
  },
  {
    slug: "payments",
    title: "Payments",
    description: "Paystack, Flutterwave, Stripe, Monnify keys",
    icon: CreditCard,
    countGroups: ["PAYMENTS"],
    href: "/admin/settings/payments",
  },
  {
    slug: "email",
    title: "Email & SMS",
    description: "Email provider, SMS gateway, templates",
    icon: Mail,
    countGroups: ["EMAIL", "SMS"],
    href: "/admin/settings/email",
  },
  {
    slug: "social",
    title: "Social media",
    description: "Instagram, TikTok, Facebook, WhatsApp",
    icon: Share2,
    countGroups: ["SOCIAL"],
    href: "/admin/settings/social",
  },
  {
    slug: "loyalty",
    title: "Loyalty",
    description: "Points configuration and referral rewards",
    icon: Star,
    countGroups: ["LOYALTY"],
    href: "/admin/settings/loyalty",
  },
  {
    slug: "notifications",
    title: "Notifications",
    description: "Admin alerts and Slack integration",
    icon: Bell,
    countGroups: ["NOTIFICATIONS"],
    href: "/admin/settings/notifications",
  },
  {
    slug: "seo",
    title: "SEO",
    description: "Meta titles, descriptions, OG image",
    icon: Search,
    countGroups: ["SEO"],
    href: "/admin/settings/seo",
  },
  {
    slug: "media",
    title: "Media library",
    description: "Upload and manage all site media",
    icon: ImageIcon,
    href: "/admin/settings/media",
    countKind: "media",
  },
  {
    slug: "gallery",
    title: "Gallery",
    description: "Manage Atelier and Bridal gallery images",
    icon: Images,
    href: "/admin/gallery",
    countKind: "images",
  },
];

export default async function AdminSettingsOverviewPage() {
  const grouped = await prisma.siteSetting.groupBy({
    by: ["group"],
    _count: { _all: true },
  });
  const countByGroup = Object.fromEntries(grouped.map((g) => [g.group, g._count._all])) as Record<string, number>;
  const [galleryCount, mediaCount] = await Promise.all([
    prisma.galleryImage.count(),
    prisma.mediaItem.count(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl text-black">Settings</h1>
      <p className="mt-1 font-body text-[13px] text-[#6B6B68]">Manage your store configuration</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          const n =
            card.countKind === "images"
              ? galleryCount
              : card.countKind === "media"
                ? mediaCount
                : (card.countGroups?.reduce((s, g) => s + (countByGroup[g] ?? 0), 0) ?? 0);
          const countLabel =
            card.countKind === "images" ? "images" : card.countKind === "media" ? "files" : "settings";
          return (
            <Link
              key={card.slug}
              href={card.href}
              className="group flex border border-[#EBEBEA] bg-white p-6 transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex min-w-0 flex-1 gap-4">
                <Icon className="h-8 w-8 shrink-0 text-[#37392d]" strokeWidth={1.25} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm font-medium text-black">{card.title}</p>
                  <p className="mt-1 font-body text-[13px] leading-snug text-[#6B6B68]">{card.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-between gap-2 pl-2">
                <span className="whitespace-nowrap font-body text-[11px] text-[#6B6B68]">
                  {n} {countLabel}
                </span>
                <span className="font-body text-sm text-[#37392d] transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
