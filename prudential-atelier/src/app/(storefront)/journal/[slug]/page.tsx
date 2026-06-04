import { JournalArticleClient } from "@/components/public/JournalArticleClient";

type Props = { params: Promise<{ slug: string }> };

export default async function JournalArticlePage({ params }: Props) {
  const { slug } = await params;
  return <JournalArticleClient slug={slug} />;
}
