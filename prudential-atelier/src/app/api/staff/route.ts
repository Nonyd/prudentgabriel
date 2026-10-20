import { NextRequest, NextResponse } from "next/server";
import { EmploymentType, Prisma, Role, StaffDepartment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, resolveSessionAccess } from "@/lib/admin-auth";
import { CAPABILITY_TTL_MS } from "@/lib/capability-token";
import { sendEmail } from "@/lib/email";
import { issuePasswordResetToken, passwordLinkUrl } from "@/lib/password-reset";
import { hasPermission, isProtectedAccount } from "@/lib/roles";
import { unusablePasswordHash } from "@/lib/temp-password";
import { logActivity, logError } from "@/lib/logger";

const DEPARTMENTS = new Set<string>(Object.values(StaffDepartment));
const EMPLOYMENT_TYPES = new Set<string>(Object.values(EmploymentType));

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi("staff");
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = new URL(req.url);
    const department = searchParams.get("department");
    const employmentType = searchParams.get("employmentType");
    const active = searchParams.get("active");
    const search = searchParams.get("search")?.trim();

    const where: Prisma.StaffProfileWhereInput = {};
    if (department && department !== "all" && DEPARTMENTS.has(department)) {
      where.department = department as StaffDepartment;
    }
    if (employmentType && employmentType !== "all" && EMPLOYMENT_TYPES.has(employmentType)) {
      where.employmentType = employmentType as EmploymentType;
    }
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (search) {
      where.user = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const items = await prisma.staffProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, image: true } },
        assignments: {
          where: { completedAt: null },
          select: { id: true, orderId: true, role: true },
        },
      },
    });

    return NextResponse.json({ items });
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_LIST",
      message: e instanceof Error ? e.message : "Failed to list staff",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Invite a staff member. Needs "Invite staff" (or Staff, which includes it).
 * Always a Staff account: whoever holds only this permission can never create
 * an admin. The new person gets a link to choose their own password.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("staff.invite");
  if (!gate.ok) return gate.response;

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    department?: string;
    employmentType?: string;
    skillTags?: string[];
    isActive?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }
  if (!body.department || !DEPARTMENTS.has(body.department)) {
    return NextResponse.json({ error: "Valid department is required" }, { status: 400 });
  }

  const employmentType =
    body.employmentType && EMPLOYMENT_TYPES.has(body.employmentType)
      ? (body.employmentType as EmploymentType)
      : EmploymentType.EMPLOYEE;

  if (isProtectedAccount(email)) {
    return NextResponse.json({ error: "That email is reserved" }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    // A password nobody knows. The email carries a set-your-password link, never a password.
    const hashedPassword = await unusablePasswordHash();

    const staff = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phone: body.phone?.trim() || null,
          password: hashedPassword,
          role: Role.STAFF,
          isStaff: true,
          isActive: true,
        },
      });

      return tx.staffProfile.create({
        data: {
          userId: user.id,
          department: body.department as StaffDepartment,
          employmentType,
          skillTags: body.skillTags ?? [],
          isActive: body.isActive ?? true,
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });
    });

    await logActivity({
      userId: gate.session.user.id,
      userEmail: gate.session.user.email ?? undefined,
      userRole: gate.session.user.role ?? undefined,
      action: "CREATE",
      module: "staff",
      description: `Invited staff member ${name} (${email})`,
      recordId: staff.id,
      recordType: "StaffProfile",
    });

    const { raw } = await issuePasswordResetToken(staff.user.id, CAPABILITY_TTL_MS.welcomePassword);
    const firstName = name.split(/\s+/)[0] ?? name;
    await sendEmail({
      to: email,
      subject: "You've been added to Prudential Atelier",
      html: `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>You've been set up on the Prudential Atelier staff system.</p>
    <p>Your sign-in email is ${escapeHtml(email)}. <a href="${passwordLinkUrl(raw)}">Choose your password</a> to finish setting up.</p>
    <p>The link works once, for seven days. After that, ask the admin who added you to send a password link again.</p>
    <p>— Prudential Atelier</p>
  `,
      template: "user-invite",
      idempotencyKey: `user-invite:${staff.user.id}`,
      relatedType: "User",
      relatedId: staff.user.id,
    });

    // Someone who may only invite cannot open staff profiles; the form says where the invite went.
    const access = await resolveSessionAccess(gate.session);
    return NextResponse.json(
      { item: staff, invitedEmail: email, canOpenProfile: hasPermission(access.role, "staff", access.actor) },
      { status: 201 },
    );
  } catch (e) {
    await logError({
      severity: "WARNING",
      errorType: "STAFF_CREATE",
      message: e instanceof Error ? e.message : "Failed to create staff",
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
