import { Buffer } from "node:buffer";
import { NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { cloudinary } from "@/lib/cloudinary";
import { slugifyText } from "@/lib/utils";

type PreviewProduct = {
  rowIndex: number;
  name: string;
  slug: string;
  imageUrls: string[];
  firstImageUrl: string;
  description: string;
  shortDesc: string;
  sku: string;
  stock: number;
  isDuplicate: boolean;
};

type ImportBody = {
  selectedIndices: number[];
  products: PreviewProduct[];
};

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  let body: ImportBody;
  try {
    body = (await req.json()) as ImportBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const selectedSet = new Set(body.selectedIndices ?? []);
  const selectedProducts = (body.products ?? []).filter((p) => selectedSet.has(p.rowIndex));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total: selectedProducts.length });

      for (let i = 0; i < selectedProducts.length; i += 1) {
        const product = selectedProducts[i];
        send({
          type: "progress",
          current: i + 1,
          total: selectedProducts.length,
          name: product.name,
        });

        try {
          const cloudinaryUrls: string[] = [];
          for (const imageUrl of product.imageUrls.slice(0, 5)) {
            try {
              const imageResponse = await fetch(imageUrl, {
                signal: AbortSignal.timeout(10_000),
              });
              if (!imageResponse.ok) continue;
              const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
              const buffer = await imageResponse.arrayBuffer();
              const dataUri = `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
              const uploadResult = await cloudinary.uploader.upload(dataUri, {
                folder: "prudent-gabriel/products",
                transformation: [
                  { width: 1200, crop: "limit" },
                  { quality: "auto" },
                  { fetch_format: "auto" },
                ],
              });
              cloudinaryUrls.push(uploadResult.secure_url);
            } catch (imageError) {
              console.error(`[import] image failed for ${product.name}`, imageError);
            }
          }

          const baseSlug = slugifyText(product.name);
          let suffix = 0;
          let finalSlug = baseSlug;
          while (true) {
            const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
            const existing = await prisma.product.findUnique({
              where: { slug: candidate },
              select: { id: true },
            });
            if (!existing) {
              finalSlug = candidate;
              break;
            }
            suffix += 1;
          }

          const created = await prisma.product.create({
            data: {
              name: product.name,
              slug: finalSlug,
              description: product.description || product.shortDesc || "",
              details: product.shortDesc || "",
              category: "CASUAL",
              type: "RTW",
              tags: [],
              basePriceNGN: 0,
              priceNGN: 0,
              isPublished: false,
              isFeatured: false,
              isNewArrival: false,
              isBespokeAvail: false,
              inStock: product.stock > 0,
              images: {
                create: cloudinaryUrls.map((url, idx) => ({
                  url,
                  alt: product.name,
                  isPrimary: idx === 0,
                  sortOrder: idx,
                })),
              },
              variants: {
                create: [
                  {
                    size: "One Size",
                    sku: product.sku || `PG-${finalSlug.toUpperCase().slice(0, 8)}`,
                    priceNGN: 0,
                    stock: Math.max(product.stock, 1),
                    lowStockAt: 3,
                    sortOrder: 0,
                  },
                ],
              },
            },
          });

          send({
            type: "product_done",
            current: i + 1,
            total: selectedProducts.length,
            name: product.name,
            productId: created.id,
            imageCount: cloudinaryUrls.length,
            imageIssue: cloudinaryUrls.length < product.imageUrls.length,
          });
        } catch (productError) {
          send({
            type: "product_error",
            current: i + 1,
            total: selectedProducts.length,
            name: product.name,
            error: productError instanceof Error ? productError.message : "Unknown error",
          });
        }
      }

      send({ type: "complete", imported: selectedProducts.length });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
