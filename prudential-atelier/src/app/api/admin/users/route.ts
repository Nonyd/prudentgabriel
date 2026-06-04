import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/admin-auth";
import { INVITE_ROLES, MANAGED_STAFF_ROLES } from "@/lib/admin-users";
import { getPublicAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isProtectedAccount } from "@/lib/roles";
import { generateTempPassword } from "@/lib/temp-password";

const createSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email(),
  role: z.enum([
    "ADMIN",
    "STAFF_ADMIN",
    "BESPOKE_MANAGER",
    "RTW_MANAGER",
    "CONTENT_MANAGER",
    "FINANCE_MANAGER",
    "HR_MANAGER",
    "CONSULTATION_MANAGER",
    "STAFF",
  ]),
});

function serializeUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    isProtected: isProtectedAccount(user.email),
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50") || 50));
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const where: {
    role: { in: Role[] } | Role;
    isActive?: boolean;
    OR?: Array<{ name?: { contains: string; mode: "insensitive" }; email?: { contains: string; mode: "insensitive" } }>;
  } = {
    role:
      role && role !== "all" && MANAGED_STAFF_ROLES.includes(role as Role)
        ? (role as Role)
        : { in: MANAGED_STAFF_ROLES },
  };

  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    items: users.map(serializeUser),
    total,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdminApi();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!INVITE_ROLES.includes(parsed.data.role as Role)) {
    return NextResponse.json({ error: "Invalid role for invitation" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const loginUrl = `${getPublicAppUrl()}/admin-login`;
  const firstName = parsed.data.name.trim().split(/\s+/)[0] ?? parsed.data.name.trim();

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      password: passwordHash,
      role: parsed.data.role as Role,
      mustResetPassword: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLogin: true,
      createdAt: true,
    },
  });

  const html = `
    <p>Hi ${firstName},</p>
    <p>You've been given access to the Prudential Atelier operations system.</p>
    <p><strong>Your login details:</strong><br/>
    URL: <a href="${loginUrl}">prudentgabriel.com/admin-login</a><br/>
    Email: ${email}<br/>
    Temporary password: <strong>${tempPassword}</strong></p>
    <p>You'll be asked to set a new password on first login.</p>
    <p>— Prudential Atelier</p>
  `;

  await sendEmail({
    to: email,
    subject: "You've been added to Prudential Atelier — Operations Suite",
    html,
  });

  await logActivity({
    userId: gate.session.user.id,
    userEmail: gate.session.user.email ?? undefined,
    userRole: gate.session.user.role,
    action: "CREATE",
    module: "users",
    description: `Invited ${email} as ${parsed.data.role}`,
    recordId: user.id,
    recordType: "User",
  });

  return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
}
