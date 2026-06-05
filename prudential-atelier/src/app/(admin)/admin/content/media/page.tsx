import Link from "next/link";
import { MediaLibraryTab } from "@/components/admin/settings/MediaLibraryTab";

export default function AdminContentMediaPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/content"
          className="mb-4 inline-block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-light hover:text-choc"
        >
          ← Content
        </Link>
        <p className="eyebrow">Content</p>
        <h1 className="font-display text-2xl text-ink">Media library</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Uploaded files from the CMS and admin tools. Delete unused assets to keep storage tidy.
        </p>
      </div>
      <MediaLibraryTab />
    </div>
  );
}
