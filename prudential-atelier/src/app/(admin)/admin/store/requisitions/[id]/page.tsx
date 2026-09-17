import { StoreRequisitionDetailClient } from "@/components/admin/store/StoreRequisitionDetailClient";

export default async function AdminStoreRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StoreRequisitionDetailClient id={id} />;
}
