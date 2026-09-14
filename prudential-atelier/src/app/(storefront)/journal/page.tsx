import type { Metadata } from "next";
import { JournalListClient } from "@/components/public/JournalListClient";
import { cmsGet, getCMSContent } from "@/lib/cms";
import { listPublishedJournalPosts, toJournalListJson } from "@/lib/journal";
import { cmsRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return cmsRouteMetadata("journal", "/journal");
}

export default async function JournalPage() {
  const [cms, listed] = await Promise.all([
    getCMSContent(["journal_page_eyebrow", "journal_page_title", "journal_page_subtitle"]),
    listPublishedJournalPosts({ page: 1, limit: 9 }),
  ]);

  return (
    <JournalListClient
      eyebrow={cmsGet(cms, "journal_page_eyebrow", "THE JOURNAL")}
      title={cmsGet(cms, "journal_page_title", "Style & Stories")}
      subtitle={cmsGet(
        cms,
        "journal_page_subtitle",
        "Stories from the atelier, styling notes, and behind-the-scenes craft.",
      )}
      initialItems={listed.items.map(toJournalListJson)}
      initialTotal={listed.total}
    />
  );
}
