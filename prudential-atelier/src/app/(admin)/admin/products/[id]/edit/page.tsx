import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductFormPage } from "@/components/admin/ProductFormPage";

export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" } },
      colors: true,
      bundleItems: { select: { targetProductId: true, targetProduct: { select: { name: true } } } },
    },
  });
  if (!product) notFound();
  return <ProductFormPage product={product} />;
}
