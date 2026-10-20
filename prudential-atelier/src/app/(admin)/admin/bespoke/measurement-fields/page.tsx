import { AtelierMeasurementFieldsClient } from "@/components/admin/AtelierMeasurementFieldsClient";

export const metadata = { title: "Measurement fields" };

/** Atelier managers and admins (Atelier pipeline permission, from the /admin/bespoke rule). */
export default function AtelierMeasurementFieldsPage() {
  return <AtelierMeasurementFieldsClient />;
}
