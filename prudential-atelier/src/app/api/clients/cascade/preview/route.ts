import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { ProductCascadeError } from "@/lib/product-cascade-delete";
import { previewClientCascade } from "@/lib/client-cascade-delete";
import { MAX_CLIENT_CASCADE } from "@/lib/client-cascade-copy";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_CLIENT_CASCADE),
});

/** What deleting these clients would take with them — shown before anything happens. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("clients");
  if (!gate.ok) return gate.response;

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
    const preview = await previewClientCascade(parsed.data.ids);
    // The dialog says whose name the activity log will carry.
    return NextResponse.json({ ...preview, actorEmail: gate.session.user.email ?? null });
  } catch (e) {
    if (e instanceof ProductCascadeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Could not preview delete" }, { status: 500 });
  }
}
