"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { FileText, Images, Image as ImageIcon, Layout, Newspaper } from "lucide-react";

const CARDS: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/admin/content/pages",
    title: "Page content",
    description: "Edit copy, images, and sections for every public page on the site.",
    icon: Layout,
  },
  {
    href: "/admin/content/blog",
    title: "Blog / Journal",
    description: "Write and publish journal articles and editorial posts.",
    icon: Newspaper,
  },
  {
    href: "/admin/gallery",
    title: "Portfolio gallery",
    description: "Curate Atelier, Bridal, and Kids gallery images shown on brand pages.",
    icon: Images,
  },
  {
    href: "/admin/content/media",
    title: "Media library",
    description: "Browse and manage uploaded files used across the site.",
    icon: ImageIcon,
  },
];

export function ContentHubClient() {
  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Website</p>
        <h1 className="font-display text-2xl text-ink">Content</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Manage everything visitors read and see on the public site.
        </p>
      </div>

      <div className="rounded-lg border border-sand/80 bg-bg-card px-4 py-3">
        <p className="font-sans text-[13px] leading-relaxed text-text-mid">
          <span className="font-medium text-ink">Page content</span> is the primary editor for live site copy.
          Use <span className="font-medium text-ink">Appearance</span> in Settings for global logos and brand
          assets. Portfolio grids live in the gallery.
        </p>
        <Link
          href="/admin/settings/appearance"
          className="mt-2 inline-flex items-center gap-1 font-sans text-xs text-choc hover:underline"
        >
          <FileText className="h-3.5 w-3.5" />
          Brand & appearance settings
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex rounded-lg border border-sand bg-bg-card p-6 transition-colors hover:border-choc/20 hover:bg-bg/40"
            >
              <div className="flex min-w-0 flex-1 gap-4">
                <Icon className="h-8 w-8 shrink-0 text-choc" strokeWidth={1.25} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm font-medium text-ink">{card.title}</p>
                  <p className="mt-1 font-sans text-[13px] leading-snug text-text-mid">{card.description}</p>
                </div>
              </div>
              <span className="shrink-0 self-center font-sans text-sm text-choc transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
