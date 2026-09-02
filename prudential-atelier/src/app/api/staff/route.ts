import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { EmploymentType, Prisma, Role, StaffDepartment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-auth";
import { logActivity, logError } from "@/lib/logger";

const DEPARTMENTS = new Set<string>(Object.values(StaffDepartment));
const EMPLOYMENT_TYPES = new Set<string>(Object.values(EmploymentType));

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

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi("staff");
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

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const tempPassword = nanoid(16);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

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
      description: `Created staff member ${name} (${email})`,
      recordId: staff.id,
      recordType: "StaffProfile",
    });

    return NextResponse.json(
      { item: staff, tempPassword },
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
