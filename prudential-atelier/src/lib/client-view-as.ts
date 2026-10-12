import { createHmac, timingSafeEqual } from "node:crypto";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/logger";
import { VIEW_AS_TTL_MS, describeViewAsRequest } from "@/lib/client-view-as-rules";

/**
 * "View as client" — the admin's session becomes the client's.
 *
 * Start: POST /api/admin/clients/:id/view-as checks who may, mints a short-lived
 * ticket signed with AUTH_SECRET, and hands it to the session update. The JWT
 * callback (lib/auth.ts) accepts only a valid ticket for the signed-in admin and
 * swaps the token to the client, keeping the admin in `token.viewAs`. Anyone can
 * ask the session endpoint for an update, so the ticket — not the request — is
 * what proves the admin was allowed.
 *
 * End: the banner's "Exit", the hour running out, or the admin losing access
 * restores the token to the admin. Every page and change in between is logged
 * under the admin (logViewAsRequest).
 */

const TICKET_TTL_MS = 60 * 1000;

export type ViewAsTicket = {
  actorId: string;
  targetUserId: string;
  clientProfileId: string;
  exp: number;
};

/** Kept in the JWT while viewing as a client: who the admin is, to restore them. */
export type ViewAsClaim = {
  actorId: string;
  actorEmail: string;
  actorName: string | null;
  actorPicture: string | null;
  actorReferralCode: string;
  actorPointsBalance: number;
  targetUserId: string;
  clientProfileId: string;
  clientName: string;
  startedAt: number;
  exp: number;
};

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function sign(body: string): string {
  return createHmac("sha256", `view-as:${secret()}`).update(body).digest("base64url");
}

export function signViewAsTicket(ticket: Omit<ViewAsTicket, "exp">, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...ticket, exp: now + TICKET_TTL_MS }), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyViewAsTicket(raw: unknown, now = Date.now()): ViewAsTicket | null {
  if (typeof raw !== "string" || !secret()) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const a = Buffer.from(raw.slice(dot + 1));
  const b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ViewAsTicket;
    if (!t?.actorId || !t.targetUserId || !t.clientProfileId || typeof t.exp !== "number") return null;
    if (t.exp <= now) return null;
    return t;
  } catch {
    return null;
  }
}

export function readViewAsClaim(token: JWT): ViewAsClaim | null {
  const v = token.viewAs as ViewAsClaim | undefined;
  return v && typeof v.actorId === "string" && typeof v.exp === "number" ? v : null;
}

/**
 * Called by the JWT callback on a session update carrying a ticket. Swaps the
 * token to the client when the ticket is valid for this admin and she is an
 * active customer. Returns whether it did.
 */
export async function beginViewAs(token: JWT, rawTicket: unknown, now = Date.now()): Promise<boolean> {
  if (readViewAsClaim(token)) return false;
  const ticket = verifyViewAsTicket(rawTicket, now);
  if (!ticket || ticket.actorId !== token.id) return false;

  const [target, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ticket.targetUserId },
      select: { id: true, email: true, name: true, image: true, role: true, isActive: true, referralCode: true, pointsBalance: true },
    }),
    prisma.clientProfile.findUnique({ where: { id: ticket.clientProfileId }, select: { userId: true } }),
  ]);
  if (!target || !target.isActive || target.role !== "CUSTOMER") return false;
  if (profile?.userId !== target.id) return false;

  const claim: ViewAsClaim = {
    actorId: ticket.actorId,
    actorEmail: (token.email as string | undefined) ?? "",
    actorName: (token.name as string | undefined) ?? null,
    actorPicture: (token.picture as string | undefined) ?? null,
    actorReferralCode: token.referralCode ?? "",
    actorPointsBalance: token.pointsBalance ?? 0,
    targetUserId: target.id,
    clientProfileId: ticket.clientProfileId,
    clientName: target.name?.trim() || target.email,
    startedAt: now,
    exp: now + VIEW_AS_TTL_MS,
  };
  token.viewAs = claim;
  token.id = target.id;
  token.sub = target.id;
  token.email = target.email;
  token.name = target.name;
  token.picture = target.image;
  token.referralCode = target.referralCode;
  token.pointsBalance = target.pointsBalance;
  return true;
}

/** Back to the admin. The JWT callback then reloads the admin's role and permissions. */
export function endViewAs(token: JWT): ViewAsClaim | null {
  const claim = readViewAsClaim(token);
  if (!claim) return null;
  token.id = claim.actorId;
  token.sub = claim.actorId;
  token.email = claim.actorEmail;
  token.name = claim.actorName;
  token.picture = claim.actorPicture;
  token.referralCode = claim.actorReferralCode;
  token.pointsBalance = claim.actorPointsBalance;
  delete token.viewAs;
  return claim;
}

/**
 * Whether the admin behind a view-as session may still hold it. Read on every
 * request: an admin who is deactivated, demoted to customer or has changed
 * their password since signing in loses the session, as they would their own.
 */
export async function viewAsActorStillValid(claim: ViewAsClaim, issuedAt: number | undefined): Promise<boolean> {
  const actor = await prisma.user.findUnique({
    where: { id: claim.actorId },
    select: { isActive: true, role: true, passwordChangedAt: true },
  });
  if (!actor || !actor.isActive || actor.role === "CUSTOMER") return false;
  if (actor.passwordChangedAt && typeof issuedAt === "number" && actor.passwordChangedAt.getTime() > issuedAt * 1000) {
    return false;
  }
  return true;
}

/** The session's view-as info, if this session is an admin viewing as a client. */
export function sessionViewAs(session: Session | null | undefined) {
  return session?.user?.viewAs ?? null;
}

/** One activity-log line for something the admin did while viewing as the client. */
export async function logViewAsRequest(
  session: Session,
  req: { method: string; pathname: string; serverAction?: boolean; ipAddress?: string },
): Promise<void> {
  const v = sessionViewAs(session);
  if (!v || !session.user?.id) return;
  await logActivity({
    userId: v.actorId,
    userEmail: v.actorEmail,
    impersonatedUserId: session.user.id,
    impersonatedEmail: session.user.email ?? undefined,
    action: "CLIENT_VIEW_AS_ACTION",
    module: "view-as",
    description: `As ${v.clientName}: ${describeViewAsRequest(req.method, req.pathname, Boolean(req.serverAction))}`,
    recordId: v.clientProfileId,
    recordType: "ClientProfile",
    ipAddress: req.ipAddress,
  });
}
