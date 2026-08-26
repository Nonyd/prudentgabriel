import { NextRequest, NextResponse } from "next/server";
import { requireGeneralAdminApi } from "@/lib/admin-auth";
import { previewRecipients, type SendEmailSource } from "@/lib/send-email-recipients";

const VALID = new Set<SendEmailSource>([
  "newsletter",
  "customers",
  "rtw_purchasers",
  "collection_buyers",
  "gold_platinum",
  "active_orders",
  "upcoming_consultations",
  "specific",
  "custom",
  "all",
]);

export async function GET(req: NextRequest) {
  const gate = await requireGeneralAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("sources") ?? searchParams.get("recipientType") ?? "customers";
  const sources = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SendEmailSource => VALID.has(s as SendEmailSource));
  if (sources.length === 0) {
    return NextResponse.json({ error: "No valid sources" }, { status: 400 });
  }

  const preview = await previewRecipients(sources, {
    specificUserId: searchParams.get("specificUserId") ?? undefined,
    customEmail: searchParams.get("customEmail") ?? undefined,
    collectionId: searchParams.get("collectionId") ?? undefined,
  });
  return NextResponse.json(preview);
}
