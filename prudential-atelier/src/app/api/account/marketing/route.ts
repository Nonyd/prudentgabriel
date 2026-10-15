import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { isEmailVerified } from "@/lib/email-verification";
import { logServerError } from "@/lib/logger";
import {
  getMarketingConsentState,
  grantMarketingConsent,
  withdrawMarketingConsent,
} from "@/lib/marketing-consent";

/** Her marketing-email consent, as the settings toggle shows it. */
export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  const state = await getMarketingConsentState(gate.session.user.id!);
  return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
}

const patchSchema = z.object({ optIn: z.boolean() });

/** Opt in (consent recorded, source 'account') or out (consent cleared, address suppressed). */
export async function PATCH(req: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;
  // Consent is hers to give: an admin viewing as her cannot give or withdraw it.
  if (gate.session.user.viewAs) {
    return NextResponse.json(
      { error: "Not while viewing as a client: her marketing consent is hers to give." },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const userId = gate.session.user.id!;
  try {
    if (parsed.data.optIn) {
      await grantMarketingConsent({ userId, source: "account", emailProven: await isEmailVerified(userId) });
    } else {
      await withdrawMarketingConsent(userId);
    }
    return NextResponse.json(await getMarketingConsentState(userId));
  } catch (error) {
    await logServerError({ errorType: "ACCOUNT_MARKETING_CONSENT", error, userId });
    return NextResponse.json({ error: "Could not save your choice. Please try again." }, { status: 500 });
  }
}
