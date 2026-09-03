import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isSuperAdmin } from "@/lib/roles";

export const ADMIN_IMPERSONATE_COOKIE = "pg_admin_impersonate";
export const IMPERSONATE_TTL_MS = 30 * 60 * 1000;

export type ImpersonationPayload = {
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetEmail: string;
  targetName: string;
  targetRole: string;
  exp: number;
};

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export function signImpersonationPayload(payload: ImpersonationPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function parseImpersonationCookie(raw: string | undefined | null): ImpersonationPayload | null {
  if (!raw || !secret()) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ImpersonationPayload;
    if (!payload?.actorId || !payload?.targetId || typeof payload.exp !== "number") return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function impersonationCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

export function assertCanImpersonateTarget(opts: {
  actorId: string;
  actorRole: string | undefined | null;
  actorEmail: string | null | undefined;
  targetId: string;
  targetRole: string;
}): { ok: true } | { ok: false; error: string } {
  if (!isSuperAdmin(opts.actorRole, opts.actorEmail)) {
    return { ok: false, error: "Only a Super Admin can view as another user." };
  }
  if (opts.targetRole === "SUPER_ADMIN") {
    return { ok: false, error: "Cannot view as another Super Admin." };
  }
  if (opts.actorId === opts.targetId) {
    return { ok: false, error: "Already signed in as this user." };
  }
  return { ok: true };
}

export async function getAdminImpersonation(
  sessionRole?: string | null,
  sessionEmail?: string | null,
): Promise<ImpersonationPayload | null> {
  if (!isSuperAdmin(sessionRole, sessionEmail)) return null;
  try {
    const jar = await cookies();
    return parseImpersonationCookie(jar.get(ADMIN_IMPERSONATE_COOKIE)?.value);
  } catch {
    return null;
  }
}

export function impersonationRemainingMs(payload: ImpersonationPayload, now = Date.now()): number {
  return Math.max(0, payload.exp - now);
}
