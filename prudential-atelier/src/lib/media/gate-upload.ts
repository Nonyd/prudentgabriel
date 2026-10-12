import { NextResponse } from "next/server";
import { requireAdminApi, requireAdminPortalApi } from "@/lib/admin-auth";
import { permissionForUploadFolder } from "@/lib/admin-upload-folder";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function gateUploadFolder(folder: string) {
  const needed = permissionForUploadFolder(folder);
  if (!needed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (needed === "portal") return requireAdminPortalApi();
  if (needed === "workroom") return requireWorkroomUploader();
  return requireAdminApi(needed);
}

/**
 * BD7: staff upload pictures of their work through the same route, store and
 * limits as the house. Only someone with a staff profile and an open assignment.
 */
async function requireWorkroomUploader() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const open = await prisma.orderAssignment.findFirst({
    where: { completedAt: null, staffProfile: { userId: session.user.id } },
    select: { id: true },
  });
  if (!open) return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, session };
}
