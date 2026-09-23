import { notFound } from "next/navigation";
import { tokenPageRateLimited } from "@/lib/page-rate-limit";
import { AcceptInviteClient } from "@/components/auth/AcceptInviteClient";
import { findPendingInvitationByToken } from "@/lib/capability-token-lookup";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (await tokenPageRateLimited("invite-token-page")) notFound();
  const params = await searchParams;
  const token = params.token?.trim();
  // Unknown, expired and already-accepted invitations answer alike: a 404.
  const invitation = token ? await findPendingInvitationByToken(token) : null;
  if (!token || !invitation) notFound();

  return <AcceptInviteClient token={token} email={invitation.email} role={invitation.role} />;
}
