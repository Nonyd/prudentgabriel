import type { Metadata } from "next";
import { ImportPageClient } from "@/components/admin/ImportPageClient";

export const metadata: Metadata = {
  title: "Import Products | Admin",
};

export default function AdminImportPage() {
  return <ImportPageClient />;
}
