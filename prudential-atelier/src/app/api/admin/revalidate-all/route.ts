import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { revalidateSettings } from "@/lib/revalidate";

export async function POST() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  await revalidateSettings();
  return NextResponse.json({ success: true, revalidated: true });
}
