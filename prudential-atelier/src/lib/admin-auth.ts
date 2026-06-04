import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

export function isAdminRole(role: string | undefined): boolean {
  return (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "STAFF_ADMIN" ||
    (typeof role === "string" && role.endsWith("_MANAGER"))
  );
}

/** For API route handlers: returns session or a JSON NextResponse (401/403). */
export async function requireAdminApi(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isAdminRole(session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export function isGeneralAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** SUPER_ADMIN and ADMIN (General Manager) only. */
export async function requireGeneralAdminApi(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isGeneralAdminRole(session.user.role)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export async function requireSuperAdminApi(): Promise<
  { ok: true; session: Session } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "SUPER_ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
