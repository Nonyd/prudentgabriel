import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasPermission, type AdminPermission } from "@/lib/roles";
import { BESPOKE_ADMIN_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { canSeePaymentDetails } from "@/lib/bespoke-data-access";
import {
  bespokeAllows,
  bespokeView,
  type BespokeFacts,
  type BespokeLevel,
  type BespokeView,
} from "@/lib/atelier/bespoke-access-rules";

export { bespokeAllows, bespokeView, type BespokeFacts, type BespokeLevel, type BespokeView };

/** Session + database side of the atelier gate. The rule itself: bespoke-access-rules.ts. */
export type BespokeGate =
  | { ok: true; session: Session; facts: BespokeFacts; role: string }
  | { ok: false; response: NextResponse };

const forbidden = () =>
  ({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }) as const;

export async function bespokeFacts(
  session: Session,
  opts: { orderId?: string; key?: AdminPermission } = {},
): Promise<{ facts: BespokeFacts; role: string }> {
  const { role, actor, user } = await resolveSessionAccess(session);
  const email = actor.email ?? null;
  // The person the screen is for (the viewed-as user while the Super Admin views as someone).
  const assigned =
    opts.orderId && user.id
      ? Boolean(
          await prisma.orderAssignment.findFirst({
            where: { orderId: opts.orderId, staffProfile: { userId: user.id } },
            select: { id: true },
          }),
        )
      : false;
  return {
    role,
    facts: {
      house: hasPermission(role, opts.key ?? "bespoke", actor),
      money: canSeePaymentDetails({ role, email }),
      admin: sessionHasRole(role, email, BESPOKE_ADMIN_ROLES),
      assigned,
      spec: hasPermission(role, "bespoke.specification", actor),
      store: hasPermission(role, "store", actor),
      cost: hasPermission(role, "production.cost", actor),
      pipeline: hasPermission(role, "bespoke.pipeline", actor),
    },
  };
}

/** 401 without a session; 403 unless `level` passes. */
export async function requireBespokeAccess(
  level: BespokeLevel,
  opts: { orderId?: string; key?: AdminPermission } = {},
): Promise<BespokeGate> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { facts, role } = await bespokeFacts(session, opts);
  if (!bespokeAllows(level, facts)) return forbidden();
  return { ok: true, session, facts, role };
}
