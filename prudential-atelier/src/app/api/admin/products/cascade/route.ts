import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { revalidateProduct } from "@/lib/revalidate";
import {
  executeProductCascade,
  previewProductCascade,
  ProductCascadeError,
} from "@/lib/product-cascade-delete";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  confirmation: z.string().optional(),
});

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

async function afterCascade(mediaUrls: string[], slugs: string[]) {
  await Promise.all(
    mediaUrls.map((url) => destroyStoredMedia(url).catch((err) => console.error("[product-cascade media]", url, err))),
  );
  await Promise.all(slugs.map((slug) => revalidateProduct(slug).catch(() => undefined)));
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("shop.products");
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one product" }, { status: 400 });
  }

  try {
    const preview = await previewProductCascade(parsed.data.ids);
    if (preview.loud) {
      const superGate = await requireSuperAdminApi();
      if (!superGate.ok) return superGate.response;
    }

    const result = await executeProductCascade({
      productIds: parsed.data.ids,
      confirmation: parsed.data.confirmation,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.session.user.role ?? "",
        ip: clientIp(req),
      },
    });

    await afterCascade(result.mediaUrls, result.slugs);

    return NextResponse.json({
      ok: true,
      logId: result.logId,
      deleted: result.deletedProductIds.length,
      loud: result.loud,
    });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/products/cascade]", e);
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
