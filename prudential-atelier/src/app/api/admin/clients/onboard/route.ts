import { NextRequest, NextResponse } from "next/server";
import { requireBespokeAccess } from "@/lib/atelier/bespoke-access";
import { actorFromSession } from "@/lib/atelier/stage-actions";
import { onboardClientManually, onboardSchema } from "@/lib/atelier/manual-onboarding";
import { logServerError } from "@/lib/logger";

/** Admin → Clients → New client: her account, commission, payments and progress in one go. */
export async function POST(req: NextRequest) {
  const gate = await requireBespokeAccess("admin", { key: "clients" });
  if (!gate.ok) return gate.response;
  if (!gate.facts.house) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = actorFromSession(gate.session);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = onboardSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Some details are missing", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }

  try {
    const result = await onboardClientManually(parsed.data, actor);
    if (!result.ok) return NextResponse.json(result, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    void logServerError({ errorType: "CLIENT_ONBOARD", error: e, userId: actor.id, url: "/api/admin/clients/onboard" });
    return NextResponse.json({ error: "Could not add the client" }, { status: 500 });
  }
}
