import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { ADMIN_PREVIEW_COOKIE, EDITABLE_ADMIN_ROLES } from "@/lib/permission-catalog";
import { previewCookieOptions, previewRoleFromCookieValue } from "@/lib/admin-preview";

const postSchema = z.object({
  role: z.string(),
});

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const role = previewRoleFromCookieValue(parsed.data.role);
  if (!role || role === "STAFF" || !(EDITABLE_ADMIN_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Cannot preview this role." }, { status: 400 });
  }

  const jar = await cookies();
  jar.set(ADMIN_PREVIEW_COOKIE, role, previewCookieOptions(60 * 60));
  return NextResponse.json({ role });
}

export async function DELETE() {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;
  const jar = await cookies();
  jar.set(ADMIN_PREVIEW_COOKIE, "", previewCookieOptions(0));
  return NextResponse.json({ ok: true });
}
