import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductFormPage } from "@/components/admin/ProductFormPage";
import { productFormLayout } from "@/lib/product-wizard";

export default async function AdminEditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wizard?: string; step?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      measurementFields: { include: { field: true }, orderBy: { sortOrder: "asc" } },
      bundleItems: { select: { targetProductId: true, targetProduct: { select: { name: true } } } },
    },
  });
  if (!product) notFound();
  const layout = productFormLayout({ mode: "edit", wizardQuery: sp.wizard ?? null });
  const step = Number(sp.step);
  return (
    <ProductFormPage
      product={product}
      layout={layout}
      initialStep={Number.isFinite(step) ? step : undefined}
    />
  );
}
