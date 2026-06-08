import { NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { getAllEmailTemplates } from "@/lib/admin-email-template-store";

export async function GET() {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const templates = await getAllEmailTemplates();
  return NextResponse.json({ templates });
}
