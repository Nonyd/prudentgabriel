import Link from "next/link";
import type { SettingGroup } from "@prisma/client";
import {
  Bell,
  CreditCard,
  Image as ImageIcon,
  Images,
  Layout,
  Mail,
  Newspaper,
  Package,
  Palette,
  Search,
  Share2,
  Star,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { GeneralSettingsClient } from "@/components/admin/GeneralSettingsClient";

type SettingCard = {
  slug: string;
  title: string;
  description: string;
  icon: typeof Package;
  countGroups?: SettingGroup[];
  href: string;
  countKind?: "settings" | "images" | "media";
};

type CardSection = {
  title: string;
  description: string;
  cards: SettingCard[];
};

const CARD_SECTIONS: CardSection[] = [
  {
    title: "Website content",
    description: "Live site copy, blog, galleries, and uploads — managed in Content, not here.",
    cards: [
      {
        slug: "pages",
        title: "Page content",
        description: "Primary editor for all public page copy and section images",
        icon: Layout,
        href: "/admin/content/pages",
      },
      {
        slug: "blog",
        title: "Blog / Journal",
        description: "Articles and editorial posts",
        icon: Newspaper,
        href: "/admin/content/blog",
      },
      {
        slug: "gallery",
        title: "Portfolio gallery",
        description: "Atelier, Bridal, and Kids gallery grids",
        icon: Images,
        href: "/admin/gallery",
        countKind: "images",
      },
      {
        slug: "media",
        title: "Media library",
        description: "Uploaded files from CMS and admin tools",
        icon: ImageIcon,
        href: "/admin/content/media",
        countKind: "media",
      },
    ],
  },
  {
    title: "Site & brand",
    description: "Global branding, discoverability, and social presence.",
    cards: [
      {
        slug: "appearance",
        title: "Appearance",
        description: "Logos, favicon, and global fallback images",
        icon: Palette,
        countGroups: ["APPEARANCE"],
        href: "/admin/settings/appearance",
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
        slug: "social",
        title: "Social media",
        description: "Instagram, TikTok, Facebook, WhatsApp",
        icon: Share2,
        countGroups: ["SOCIAL"],
        href: "/admin/settings/social",
      },
    ],
  },
  {
    title: "Store & commerce",
    description: "Shop configuration, payments, and customer communications.",
    cards: [
      {
        slug: "store",
        title: "Store",
        description: "Store name, contact, currency, shipping thresholds",
        icon: Package,
        countGroups: ["STORE"],
        href: "/admin/settings/store",
      },
      {
        slug: "payments",
        title: "Payments",
        description: "Gateways, deposit, currencies — keys are in Developer",
        icon: CreditCard,
        countGroups: ["PAYMENTS"],
        href: "/admin/settings/payments",
      },
      {
        slug: "bank-accounts",
        title: "Bank accounts",
        description: "NGN, USD, GBP, EUR — Ready-to-Wear and Atelier",
        icon: Wallet,
        href: "/admin/settings/bank-accounts",
      },
      {
        slug: "email",
        title: "Email & SMS",
        description: "From-name and reply-to. API keys are in Developer.",
        icon: Mail,
        countGroups: ["EMAIL", "SMS"],
        href: "/admin/settings/email",
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
        description: "Admin alerts. Slack webhook is in Developer.",
        icon: Bell,
        countGroups: ["NOTIFICATIONS"],
        href: "/admin/settings/notifications",
      },
      {
        slug: "invoice",
        title: "Invoice settings",
        description: "Business details, VAT, invoice numbering",
        icon: Wallet,
        countGroups: ["INVOICE"],
        href: "/admin/settings/invoice",
      },
    ],
  },
];

function SettingCardLink({
  card,
  count,
  countLabel,
}: {
  card: SettingCard;
  count: number;
  countLabel: string;
}) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
        className="group flex rounded-[26px] glass-1 glass-panel p-6 transition-colors hover:border-[var(--glass-edge-bright)]"
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <Icon className="h-8 w-8 shrink-0 text-[#37392d]" strokeWidth={1.25} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm font-medium text-ink">{card.title}</p>
          <p className="mt-1 font-body text-[13px] leading-snug text-[#6B6B68]">{card.description}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 pl-2">
        {count > 0 ? (
          <span className="whitespace-nowrap font-body text-[11px] text-[#6B6B68]">
            {count} {countLabel}
          </span>
        ) : null}
        <span className="font-body text-sm text-[#37392d] transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}

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

  const countForCard = (card: SettingCard) => {
    if (card.countKind === "images") return galleryCount;
    if (card.countKind === "media") return mediaCount;
    return card.countGroups?.reduce((s, g) => s + (countByGroup[g] ?? 0), 0) ?? 0;
  };

  const countLabelForCard = (card: SettingCard) => {
    if (card.countKind === "images") return "images";
    if (card.countKind === "media") return "files";
    return "settings";
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="mt-2 font-serif text-2xl font-medium text-choc">Settings</h1>
        <p className="mt-1 font-sans text-[13px] text-text-mid">
          Store, brand, and system configuration. Website copy is edited under Content.
        </p>
      </div>

      <GeneralSettingsClient />

      {CARD_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4">
          <div>
            <h2 className="font-sans text-sm font-semibold text-ink">{section.title}</h2>
            <p className="mt-1 font-sans text-[13px] text-text-mid">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.cards.map((card) => (
              <SettingCardLink
                key={card.slug}
                card={card}
                count={countForCard(card)}
                countLabel={countLabelForCard(card)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
