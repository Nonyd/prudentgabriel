import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/rate-limit";
import { requireAdminApi, requireGeneralAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { destroyStoredMedia } from "@/lib/media/destroy";
import { executeClientCascade } from "@/lib/client-cascade-delete";
import { MAX_CLIENT_CASCADE } from "@/lib/client-cascade-copy";
import { ProductCascadeError } from "@/lib/product-cascade-delete";
import { logServerError } from "@/lib/logger";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_CLIENT_CASCADE),
  confirmation: z.string().optional(),
});

/**
 * Delete clients (profile + account) and everything associated, one transaction
 * per client. ADMIN or SUPER_ADMIN with the clients permission; clients with
 * payments only for a real Super Admin (not "view as"). Each deleted client is
 * logged under the account that did it.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("clients");
  if (!gate.ok) return gate.response;
  const general = await requireGeneralAdminApi();
  if (!general.ok) return general.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select at least one client" }, { status: 400 });
  }

  try {
    const superAdmin = (await requireSuperAdminApi()).ok;
    const result = await executeClientCascade({
      clientProfileIds: parsed.data.ids,
      confirmation: parsed.data.confirmation,
      superAdmin,
      actor: {
        userId: gate.session.user.id!,
        email: gate.session.user.email ?? null,
        role: gate.session.user.role ?? "",
        ip: getClientIp(req),
      },
    });

    await Promise.all(
      result.mediaUrls.map((url) =>
        destroyStoredMedia(url).catch((err) => {
          void logServerError({ errorType: "CLIENT_CASCADE_MEDIA", error: err, url });
        }),
      ),
    );

    const deleted = result.results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: deleted > 0,
      deleted,
      failed: result.results.length - deleted,
      results: result.results,
      missingIds: result.missingIds,
    });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    await logServerError({ errorType: "ADMIN_CLIENT_CASCADE", error: e });
    return NextResponse.json({ error: "Delete failed; nothing was removed" }, { status: 500 });
  }
}
