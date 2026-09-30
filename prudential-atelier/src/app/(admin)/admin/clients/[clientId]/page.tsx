import { ClientFileTabs } from "@/components/admin/ClientFileTabs";

type Props = { params: Promise<{ clientId: string }> };

export default async function AdminClientProfilePage({ params }: Props) {
  const { clientId } = await params;
  return <ClientFileTabs clientId={clientId} />;
}
