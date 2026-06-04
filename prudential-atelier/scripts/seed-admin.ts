import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.trim() || "nony@sonshubmedia.com";

const SUPER_ADMIN_PASSWORD = "Admin@PA2024!";

async function main() {
  const superAdminHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      name: "Nony",
      email: SUPER_ADMIN_EMAIL,
      password: superAdminHash,
      role: Role.SUPER_ADMIN,
      mustResetPassword: false,
      isActive: true,
    },
  });

  console.log("Admin seed complete.");
  console.log(`  Super Admin: ${superAdmin.email} (${superAdmin.role})`);
}

main()
  .catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
