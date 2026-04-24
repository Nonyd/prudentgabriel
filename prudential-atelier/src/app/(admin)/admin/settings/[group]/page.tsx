import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminSettingsGroupClient,
  type AdminSettingsGroupSlug,
} from "@/components/admin/AdminSettingsGroupClient";

const VALID = new Set<string>([
  "store",
  "payments",
  "email",
  "appearance",
  "content",
  "social",
  "loyalty",
  "notifications",
  "seo",
  "media",
]);

const TITLES: Record<AdminSettingsGroupSlug, string> = {
  store: "Store",
  payments: "Payments",
  email: "Email & SMS",
  appearance: "Appearance",
  content: "Content",
  social: "Social media",
  loyalty: "Loyalty",
  notifications: "Notifications",
  seo: "SEO",
};

export default async function AdminSettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const g = group.toLowerCase();
  if (!VALID.has(g)) notFound();
  if (g === "media") {
    redirect("/admin/gallery");
  }

  const slug = g as AdminSettingsGroupSlug;
  const title = TITLES[slug] ?? group;

  return (
    <div>
      <Link
        href="/admin/settings"
        className="mb-6 inline-block font-body text-[11px] font-medium uppercase tracking-[0.12em] text-[#6B6B68] hover:text-black"
      >
        ← Settings
      </Link>
      <h1 className="font-display text-2xl text-black">{title}</h1>
      <div className="mt-8">
        <AdminSettingsGroupClient groupSlug={slug} />
      </div>
    </div>
  );
}
