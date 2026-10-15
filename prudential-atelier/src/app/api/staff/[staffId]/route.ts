import { NextRequest, NextResponse } from "next/server";
import { EmploymentType, StaffDepartment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, requireSuperAdminApi } from "@/lib/admin-auth";
import { isProtectedAccount } from "@/lib/roles";
import { changeUserEmail } from "@/lib/admin-email-change";
import { getClientIp } from "@/lib/rate-limit";
import { logActivity, logError } from "@/lib/logger";

type Params = { params: Promise<{ staffId: string }> };

const DEPARTMENTS = new Set<string>(Object.values(StaffDepartment));
const EMPLOYMENT_TYPES = new Set<string>(Object.values(EmploymentType));

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("staff");
  if (!gate.ok) return gate.response;

  const { staffId } = await params;

  try {
    const item = await prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, image: true } },
        assignments: {
          include: {
            order: {
              select: {
                id: true,
                orderRef: true,
                clientName: true,
                currentStage: true,
                status: true,
              },
            },
          },
          orderBy: { assignedAt: "desc" },
        },
        attendanceLogs: { orderBy: { date: "desc" }, take: 30 },
      },
    });

    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_GET",
      message: e instanceof Error ? e.message : "Failed to fetch staff",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi("staff");
  if (!gate.ok) return gate.response;

  const { staffId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userUpdate: { name?: string; phone?: string | null } = {};
    if (typeof body.name === "string") userUpdate.name = body.name.trim();
    // The login email is the account: the shared rule makes it Super Admin work,
    // signs her out, logs it and tells the old address.
    const nextEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (nextEmail && nextEmail !== existing.user.email.toLowerCase()) {
      const changed = await changeUserEmail({
        targetUserId: existing.userId,
        nextEmail,
        actor: { id: gate.session.user.id!, email: gate.session.user.email, role: gate.session.user.role },
        ip: getClientIp(req),
      });
      if (!changed.ok) return NextResponse.json({ error: changed.error }, { status: changed.status });
    }
    if (typeof body.phone === "string") userUpdate.phone = body.phone.trim() || null;

    const staffUpdate: {
      department?: StaffDepartment;
      employmentType?: EmploymentType;
      skillTags?: string[];
      isActive?: boolean;
    } = {};

    if (typeof body.department === "string" && DEPARTMENTS.has(body.department)) {
      staffUpdate.department = body.department as StaffDepartment;
    }
    if (typeof body.employmentType === "string" && EMPLOYMENT_TYPES.has(body.employmentType)) {
      staffUpdate.employmentType = body.employmentType as EmploymentType;
    }
    if (Array.isArray(body.skillTags)) {
      staffUpdate.skillTags = body.skillTags.filter((t): t is string => typeof t === "string");
    }
    if (typeof body.isActive === "boolean") staffUpdate.isActive = body.isActive;

    const item = await prisma.$transaction(async (tx) => {
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: existing.userId }, data: userUpdate });
      }
      return tx.staffProfile.update({
        where: { id: staffId },
        data: staffUpdate,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "UPDATE",
      module: "staff",
      description: `Updated staff profile ${item.user.name ?? item.user.email}`,
      recordId: staffId,
      recordType: "StaffProfile",
    });

    return NextResponse.json({ item });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_PATCH",
      message: e instanceof Error ? e.message : "Failed to update staff",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  // Removing a login is Super Admin work (as in Team settings); HR deactivates instead.
  const gate = await requireSuperAdminApi();
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Only a Super Admin can delete a staff account. Mark the profile inactive instead." },
      { status: 403 },
    );
  }

  const { staffId } = await params;

  try {
    const existing = await prisma.staffProfile.findUnique({
      where: { id: staffId },
      include: { user: { select: { email: true, role: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.user.role !== "STAFF" || isProtectedAccount(existing.user.email)) {
      return NextResponse.json({ error: "This account can only be removed from Team settings." }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: existing.userId } });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "DELETE",
      module: "staff",
      description: `Deleted staff profile ${staffId}`,
      recordId: staffId,
      recordType: "StaffProfile",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_DELETE",
      message: e instanceof Error ? e.message : "Failed to delete staff",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
