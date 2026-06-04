import { ClientProfileClient } from "@/components/admin/ClientProfileClient";

type Props = { params: Promise<{ clientId: string }> };

export default async function AdminClientProfilePage({ params }: Props) {
  const { clientId } = await params;
  return <ClientProfileClient clientId={clientId} />;
}
