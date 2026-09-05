import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { executeConsultationCascade, previewConsultationCascade } from "@/lib/consultation-cascade-delete";
import { ProductCascadeError } from "@/lib/product-cascade-delete";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  confirmation: z.string().optional(),
});

function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("consultations");
  if (!gate.ok) return gate.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one consultation" }, { status: 400 });
  }

  try {
    const preview = await previewConsultationCascade(parsed.data.ids);
    if (preview.loud) {
      const superGate = await requireSuperAdminApi();
      if (!superGate.ok) return superGate.response;
    }
    if (preview.blocked) {
      return NextResponse.json({ error: preview.blockReason ?? "This consultation cannot be deleted from here" }, { status: 409 });
    }

    const result = await executeConsultationCascade({
      ids: parsed.data.ids,
      confirmation: parsed.data.confirmation,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.session.user.role ?? "",
        ip: clientIp(req),
      },
    });

    await Promise.all(
      result.mediaUrls.map((url) => destroyStoredMedia(url).catch((err) => console.error("[consultation-cascade media]", url, err))),
    );

    return NextResponse.json({
      ok: true,
      logId: result.logId,
      deleted: result.deletedIds.length,
      loud: result.loud,
    });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[admin/consultations/cascade]", e);
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
