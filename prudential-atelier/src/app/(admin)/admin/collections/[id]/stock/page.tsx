import { CollectionStockClient } from "@/components/admin/CollectionStockClient";

export default async function CollectionStockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollectionStockClient collectionId={id} />;
}
