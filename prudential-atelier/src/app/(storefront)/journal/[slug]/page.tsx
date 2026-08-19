import { JournalArticleClient } from "@/components/public/JournalArticleClient";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

export default async function JournalArticlePage({ params }: Props) {
  const { slug } = await params;
  return <JournalArticleClient slug={slug} />;
}
