import { NextResponse } from "next/server";
import { requireAdminApi, CMS_ADMIN_PERMISSIONS } from "@/lib/admin-auth";
import { revalidateSettings, revalidateStorefront } from "@/lib/revalidate";

export async function POST() {
  const gate = await requireAdminApi(CMS_ADMIN_PERMISSIONS);
  if (!gate.ok) return gate.response;

  await revalidateSettings();
  await revalidateStorefront(["/journal"]);
  return NextResponse.json({ success: true, revalidated: true });
}
