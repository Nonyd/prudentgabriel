import { PrismaClient } from "@prisma/client";
import { seedEmailTemplateDefaults } from "../src/lib/admin-email-template-store";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding email template defaults…");
  const created = await seedEmailTemplateDefaults(true);
  console.log(`Done — ${created} new setting(s) created (existing templates left unchanged).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
