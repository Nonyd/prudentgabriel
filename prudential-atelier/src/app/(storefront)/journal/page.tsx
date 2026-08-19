import { JournalListClient } from "@/components/public/JournalListClient";
import { cmsGet, getCMSContent } from "@/lib/cms";

export const revalidate = 3600;

export default async function JournalPage() {
  const cms = await getCMSContent(["journal_page_eyebrow", "journal_page_title", "journal_page_subtitle"]);

  return (
    <JournalListClient
      eyebrow={cmsGet(cms, "journal_page_eyebrow", "THE JOURNAL")}
      title={cmsGet(cms, "journal_page_title", "Style & Stories")}
      subtitle={cmsGet(
        cms,
        "journal_page_subtitle",
        "Stories from the atelier, styling notes, and behind-the-scenes craft.",
      )}
    />
  );
}
