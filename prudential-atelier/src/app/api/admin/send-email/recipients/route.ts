import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { previewRecipients, type SendEmailRecipientType } from "@/lib/send-email-recipients";

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const recipientType = (searchParams.get("recipientType") ?? "all") as SendEmailRecipientType;
  const specificUserId = searchParams.get("specificUserId") ?? undefined;

  const preview = await previewRecipients(recipientType, specificUserId);
  return NextResponse.json(preview);
}
