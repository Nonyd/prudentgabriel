import { ConsultantFormPage } from "@/components/admin/ConsultantFormPage";

export default async function EditConsultantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsultantFormPage consultantId={id} />;
}
