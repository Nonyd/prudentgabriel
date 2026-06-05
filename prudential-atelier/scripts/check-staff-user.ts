import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function listAllStaff() {
  const users = await prisma.user.findMany({
    where: { OR: [{ role: "STAFF" }, { isStaff: true }] },
    select: {
      email: true,
      role: true,
      isStaff: true,
      isActive: true,
      mustResetPassword: true,
      password: true,
      staffProfile: { select: { id: true } },
    },
    orderBy: { email: "asc" },
  });

  for (const u of users) {
    console.log({
      email: u.email,
      role: u.role,
      isStaff: u.isStaff,
      isActive: u.isActive,
      mustResetPassword: u.mustResetPassword,
      hasPassword: Boolean(u.password),
      hasStaffProfile: Boolean(u.staffProfile),
    });
  }
}

async function main() {
  if (process.argv[2] === "--all") {
    await listAllStaff();
    return;
  }

  const email = process.argv[2] ?? "tunde.kareem@prudentgabriel.com";
  const testPassword = process.argv[3] ?? "Staff@2024!";

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: {
      id: true,
      email: true,
      role: true,
      isStaff: true,
      isActive: true,
      mustResetPassword: true,
      password: true,
    },
  });

  console.log(
    "user:",
    user
      ? {
          ...user,
          password: user.password ? "[set]" : null,
        }
      : null,
  );

  if (user?.password) {
    const ok = await bcrypt.compare(testPassword, user.password);
    console.log(`password match ${testPassword}:`, ok);
  }

  if (user) {
    const staffProfile = await prisma.staffProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, isActive: true },
    });
    console.log("staffProfile:", staffProfile);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
