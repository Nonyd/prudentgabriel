import { redirect } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export default async function RTWCollectionRedirectPage({ params }: Props) {
  const { slug } = await params;
  redirect(`/collections/${slug}`);
}
