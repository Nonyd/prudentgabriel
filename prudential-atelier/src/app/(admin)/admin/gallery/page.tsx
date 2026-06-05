import Link from "next/link";
import { GalleryManager } from "@/components/admin/GalleryManager";

export default function AdminGalleryPage() {
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
        <h1 className="font-display text-2xl text-ink">Portfolio gallery</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Curated image grids for Atelier, Bridal, and Kids pages. Page headlines and intro copy are in{" "}
          <Link href="/admin/content/pages" className="text-choc hover:underline">
            Page content
          </Link>
          .
        </p>
      </div>
      <GalleryManager />
    </div>
  );
}
