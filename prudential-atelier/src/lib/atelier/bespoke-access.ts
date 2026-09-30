import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSessionAccess } from "@/lib/admin-auth";
import { hasPermission, type AdminPermission } from "@/lib/roles";
import { BESPOKE_ADMIN_ROLES, sessionHasRole } from "@/lib/bespoke-roles";
import { canSeePaymentDetails } from "@/lib/bespoke-data-access";
import { bespokeAllows, type BespokeFacts, type BespokeLevel } from "@/lib/atelier/bespoke-access-rules";

export { bespokeAllows, type BespokeFacts, type BespokeLevel };

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
  const { role, actor } = await resolveSessionAccess(session);
  const email = actor.email ?? null;
  const assigned =
    opts.orderId && session.user.id
      ? Boolean(
          await prisma.orderAssignment.findFirst({
            where: { orderId: opts.orderId, staffProfile: { userId: session.user.id } },
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
