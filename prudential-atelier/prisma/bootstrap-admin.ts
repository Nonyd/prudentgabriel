import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export type BootstrapAdminEnv = {
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
};

export type BootstrapAdminClient = {
  user: {
    findUnique: (args: { where: { email: string } }) => Promise<{ id: string } | null>;
    create: (args: {
      data: { email: string; name: string; password: string; role: Role };
    }) => Promise<unknown>;
  };
};

/**
 * Create a SUPER_ADMIN only when both env vars are set and the email is new.
 * Never updates role or password on an existing user.
 */
export async function seedBootstrapAdmin(
  prisma: BootstrapAdminClient,
  env: BootstrapAdminEnv = {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  },
): Promise<"created" | "exists" | "skipped"> {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("Skipping admin creation: ADMIN_EMAIL or ADMIN_PASSWORD is unset.");
    return "skipped";
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists; leaving role and password unchanged.`);
    return "exists";
  }

  const adminHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: "PA Admin",
      password: adminHash,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`Created SUPER_ADMIN ${email}`);
  return "created";
}
