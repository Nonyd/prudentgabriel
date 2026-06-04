import { StaffProfileClient } from "@/components/admin/StaffProfileClient";

type Props = { params: Promise<{ staffId: string }> };

export default async function AdminStaffProfilePage({ params }: Props) {
  const { staffId } = await params;
  return <StaffProfileClient staffId={staffId} />;
}
