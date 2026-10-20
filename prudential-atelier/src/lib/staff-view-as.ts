import type { Session } from "next-auth";
import { auth } from "@/auth";
import { getAdminImpersonation, type ImpersonationPayload } from "@/lib/admin-impersonate";
import { prisma } from "@/lib/prisma";

/**
 * "View as" a staff member. The Super Admin's "View as" cookie names a person;
 * when that person is Staff, the staff portal is shown as them: their tasks,
 * their time, their notifications. Read-only — the middleware refuses every
 * change while the cookie is set (clock in, work log, marking read, profile).
 *
 * Everyone else gets themselves: a staff member signed in as themselves is
 * unaffected, and nobody but the real Super Admin can view as anyone.
 */

export type StaffPortalUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  isStaff: boolean;
  jobTitle?: string;
  department?: string;
  /** Set while the Super Admin is viewing as this person. */
  viewingAs: ImpersonationPayload | null;
};

/** True for someone the staff portal is for (who it can be shown as). */
export function isStaffPortalPerson(user: { role: string; isStaff?: boolean | null }): boolean {
  return user.role === "STAFF" || user.isStaff === true;
}

/** The person the staff portal is showing, for this request. */
export async function resolveStaffPortalUser(session: Session | null): Promise<StaffPortalUser | null> {
  const u = session?.user;
  if (!u?.id) return null;

  const impersonation = await getAdminImpersonation(u.role, u.email);
  if (impersonation) {
    const target = await prisma.user.findUnique({
      where: { id: impersonation.targetId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        isStaff: true,
        isActive: true,
        jobTitle: true,
        department: true,
      },
    });
    if (target?.isActive && target.role !== "SUPER_ADMIN" && isStaffPortalPerson(target)) {
      return {
        id: target.id,
        name: target.name,
        email: target.email,
        image: target.image,
        role: target.role,
        isStaff: true,
        jobTitle: target.jobTitle ?? undefined,
        department: target.department ?? undefined,
        viewingAs: impersonation,
      };
    }
  }

  const extended = u as { jobTitle?: string; department?: string };
  return {
    id: u.id,
    name: u.name ?? null,
    email: u.email ?? "",
    image: u.image ?? null,
    role: u.role ?? "",
    isStaff: u.isStaff === true || u.role === "STAFF",
    jobTitle: extended.jobTitle,
    department: extended.department,
    viewingAs: null,
  };
}

/** For staff API routes: the effective person's id, or null when nobody is signed in. */
export async function staffPortalUserId(): Promise<string | null> {
  return (await resolveStaffPortalUser(await auth()))?.id ?? null;
}
