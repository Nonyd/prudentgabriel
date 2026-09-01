import type { Metadata } from "next";
import { ProductUploadGuide } from "@/components/admin/ProductUploadGuide";

export const metadata: Metadata = {
  title: "How to upload a product",
};

export default function ProductUploadGuidePage() {
  return <ProductUploadGuide />;
}
