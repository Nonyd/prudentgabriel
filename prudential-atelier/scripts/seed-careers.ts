import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { DEMO_CAREER_JOBS } from "./careers-demo-data";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.trim() ||
  process.env.ADMIN_EMAIL?.trim() ||
  "nony@sonshubmedia.com";

async function main() {
  console.log("💼 Seeding demo career job postings…\n");

  const admin = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  const createdBy = admin?.id ?? "demo-seed";

  for (const job of DEMO_CAREER_JOBS) {
    const deadline = new Date(Date.now() + job.deadlineDays * 24 * 60 * 60 * 1000);
    const { deadlineDays: _days, ...rest } = job;

    await prisma.jobPosting.upsert({
      where: { slug: job.slug },
      create: { ...rest, deadline, createdBy },
      update: { ...rest, deadline, createdBy },
    });

    console.log(`  ✓ ${job.title} → /careers/${job.slug}`);
  }

  console.log(`\n✅ ${DEMO_CAREER_JOBS.length} job postings ready at /careers\n`);
}

main()
  .catch((err) => {
    console.error("Careers seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
