import { prisma } from "@/lib/prisma";
import { isCreativeTeamDepartment } from "@/lib/staff-departments";

/**
 * The Creative Team (11 November 2026): every client order and its whole file —
 * client details, colours, fabric, consultation notes, mood boards, reference
 * pictures, payments, production, fittings and delivery — to read, never to
 * change. The Illustrator may also add sketches and design pictures.
 *
 * Decided from the person's active staff profile, never from the session alone.
 */
export type CreativeAccess = { creative: boolean; illustrator: boolean };

const NONE: CreativeAccess = { creative: false, illustrator: false };

export async function creativeAccessFor(userId: string | null | undefined): Promise<CreativeAccess> {
  if (!userId) return NONE;
  const staff = await prisma.staffProfile.findUnique({
    where: { userId },
    select: { department: true, isActive: true, user: { select: { isActive: true } } },
  });
  if (!staff || !staff.isActive || !staff.user.isActive) return NONE;
  if (!isCreativeTeamDepartment(staff.department)) return NONE;
  return { creative: true, illustrator: staff.department === "ILLUSTRATOR" };
}
