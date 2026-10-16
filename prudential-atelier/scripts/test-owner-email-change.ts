/**
 * The owner account (SUPER_ADMIN_EMAIL) may change its own sign-in email from
 * Account settings, with its password; nobody else may change it.
 *
 *   ALLOW_FIXTURES=true pnpm test:owner-email-change
 */
import "./preload-test-env";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const stamp = Date.now();
const ownerEmail = `test-owner-${stamp}@example.test`;
const otherEmail = `test-owner-other-${stamp}@example.test`;
// PROTECTED_ACCOUNTS is read when roles.ts loads, so set the owner first.
process.env.SUPER_ADMIN_EMAIL = ownerEmail;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { changeUserEmail } = await import("../src/lib/admin-email-change");
  const owner = await prisma.user.create({ data: { email: ownerEmail, name: "Owner", role: "SUPER_ADMIN" } });
  const other = await prisma.user.create({ data: { email: otherEmail, name: "Other", role: "SUPER_ADMIN" } });
  const moved = `test-owner-new-${stamp}@example.test`;
  try {
    const byOther = await changeUserEmail({
      targetUserId: owner.id,
      nextEmail: `test-owner-hijack-${stamp}@example.test`,
      actor: { id: other.id, email: other.email, role: "SUPER_ADMIN" },
    });
    assert(!byOther.ok && byOther.status === 403, "another Super Admin cannot change the owner's email");

    const unconfirmed = await changeUserEmail({
      targetUserId: owner.id,
      nextEmail: moved,
      actor: { id: owner.id, email: owner.email, role: "SUPER_ADMIN" },
    });
    assert(!unconfirmed.ok, "the owner needs Account settings (password) to change it");

    const own = await changeUserEmail({
      targetUserId: owner.id,
      nextEmail: moved,
      actor: { id: owner.id, email: owner.email, role: "SUPER_ADMIN" },
      selfConfirmed: true,
    });
    assert(own.ok && own.changed, `the owner changes their own email (${own.ok ? "" : own.error})`);
    const after = await prisma.user.findUnique({ where: { id: owner.id }, select: { email: true, role: true } });
    assert(after?.email === moved, "the new email is saved");
    assert(after?.role === "SUPER_ADMIN", "the owner is still Super Admin");
    console.log("test-owner-email-change: ok");
  } finally {
    await prisma.activityLog.deleteMany({ where: { recordId: { in: [owner.id, other.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
