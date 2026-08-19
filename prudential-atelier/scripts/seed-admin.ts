import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { seedBootstrapAdmin } from "../prisma/bootstrap-admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function main() {
  const result = await seedBootstrapAdmin(prisma, {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? process.env.SUPER_ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? process.env.SUPER_ADMIN_PASSWORD,
  });
  console.log(`Admin seed: ${result}`);
}

main()
  .catch((err) => {
    console.error("Admin seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
