import { ProductFormPage } from "@/components/admin/ProductFormPage";
import { getCustomGlobals } from "@/lib/custom-settings";

export default async function AdminNewProductPage() {
  const customDefaults = await getCustomGlobals();
  return <ProductFormPage customDefaults={customDefaults} />;
}
