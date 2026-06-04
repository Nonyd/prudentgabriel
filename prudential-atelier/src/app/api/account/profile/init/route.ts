import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getOrCreateClientProfile } from "@/lib/account-helpers";
import { logActivity, logError } from "@/lib/logger";

export async function POST() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  try {
    const profile = await getOrCreateClientProfile(gate.session.user.id!);

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      action: "CREATE",
      module: "account",
      description: "Client profile initialized",
      recordId: profile.id,
      recordType: "ClientProfile",
    });

    return NextResponse.json({ profile });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "ACCOUNT_PROFILE_INIT",
      message: e instanceof Error ? e.message : "Profile init failed",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
