import { prisma } from "@/lib/prisma";
import { AcceptInviteClient } from "@/components/auth/AcceptInviteClient";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  if (!token) {
    return <div className="mx-auto max-w-xl py-16 text-center font-body text-sm text-[#6B6B68]">Invalid invitation link</div>;
  }

  const invitation = await prisma.teamInvitation.findUnique({ where: { token } });
  if (!invitation) {
    return <div className="mx-auto max-w-xl py-16 text-center font-body text-sm text-[#6B6B68]">Invalid invitation link</div>;
  }
  if (invitation.expiresAt < new Date()) {
    return <div className="mx-auto max-w-xl py-16 text-center font-body text-sm text-[#6B6B68]">This invitation has expired. Contact the admin.</div>;
  }
  if (invitation.acceptedAt) {
    return <div className="mx-auto max-w-xl py-16 text-center font-body text-sm text-[#6B6B68]">This invitation has already been accepted.</div>;
  }

  return <AcceptInviteClient token={invitation.token} email={invitation.email} role={invitation.role} />;
}
