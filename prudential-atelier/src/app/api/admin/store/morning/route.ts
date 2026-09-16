import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { fromStoreError } from "@/lib/store/http";
import { morningView } from "@/lib/store/ledger";

export async function GET() {
  const gate = await requireAdminApi("store");
  if (!gate.ok) return gate.response;
  try {
    const view = await morningView();
    return NextResponse.json(view);
  } catch (e) {
    return fromStoreError(e);
  }
}
