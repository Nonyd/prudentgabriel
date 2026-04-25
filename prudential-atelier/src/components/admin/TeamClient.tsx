"use client";

import { useMemo, useState } from "react";
import type { Role, TeamInvitation } from "@prisma/client";
import { InviteAdminModal } from "@/components/admin/InviteAdminModal";

type Member = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date;
};

function initials(name: string | null, email: string): string {
  const source = (name || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function TeamClient({
  initialMembers,
  initialInvitations,
}: {
  initialMembers: Member[];
  initialInvitations: TeamInvitation[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);

  const superAdminCount = useMemo(() => members.filter((m) => m.role === "SUPER_ADMIN").length, [members]);

  async function reload() {
    const response = await fetch("/api/admin/team");
    if (!response.ok) return;
    const payload = (await response.json()) as { members: Member[]; invitations: TeamInvitation[] };
    setMembers(payload.members);
    setInvitations(payload.invitations);
  }

  async function changeRole(member: Member, role: Role) {
    const response = await fetch(`/api/admin/team/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) return;
    await reload();
  }

  async function removeMember(member: Member) {
    const response = await fetch(`/api/admin/team/${member.id}`, { method: "DELETE" });
    if (!response.ok) return;
    await reload();
  }

  async function cancelInvite(token: string) {
    const response = await fetch(`/api/admin/invitations/${token}/cancel`, { method: "DELETE" });
    if (!response.ok) return;
    await reload();
  }

  async function resendInvite(token: string) {
    const target = invitations.find((invite) => invite.token === token);
    if (!target) return;
    const response = await fetch("/api/admin/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, role: target.role }),
    });
    if (!response.ok) return;
    await reload();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] text-ink">Team</h1>
          <p className="font-body text-[13px] text-[#6B6B68]">{members.length} members</p>
        </div>
        <button type="button" onClick={() => setInviteOpen(true)} className="bg-[#37392d] px-4 py-2 font-body text-xs uppercase tracking-[0.08em] text-white">
          + Invite Admin
        </button>
      </div>

      <div className="mb-6 border border-[#EBEBEA] bg-white">
        <div className="border-b border-[#EBEBEA] px-4 py-3">
          <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Active Members</p>
        </div>
        <table className="w-full min-w-[840px]">
          <thead className="border-b border-[#EBEBEA] bg-[#FAFAFA]">
            <tr className="font-body text-[10px] uppercase tracking-[0.08em] text-[#6B6B68]">
              <th className="px-3 py-2 text-left">Avatar</th>
              <th className="px-3 py-2 text-left">Name + Email</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-[#F5F5F3]">
                <td className="px-3 py-3">
                  {member.image ? (
                    <img src={member.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#37392d] font-body text-[11px] text-white">
                      {initials(member.name, member.email)}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3">
                  <p className="font-body text-sm text-ink">{member.name || "—"}</p>
                  <p className="font-body text-xs text-[#6B6B68]">{member.email}</p>
                </td>
                <td className="px-3 py-3">
                  <span className={`px-2 py-0.5 font-body text-[10px] uppercase ${member.role === "SUPER_ADMIN" ? "bg-[#37392d] text-white" : "bg-[#F0E8FF] text-[#6B3FAD]"}`}>
                    {member.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                  </span>
                </td>
                <td className="px-3 py-3 font-body text-xs text-[#6B6B68]">{new Date(member.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="px-3 py-3 text-right">
                  <select value={member.role} onChange={(e) => void changeRole(member, e.target.value as Role)} className="mr-3 border border-[#EBEBEA] px-2 py-1 font-body text-xs">
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                  <button
                    type="button"
                    disabled={member.role === "SUPER_ADMIN" && superAdminCount <= 1}
                    onClick={() => void removeMember(member)}
                    className="font-body text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 ? (
        <div className="border border-[#EBEBEA] bg-white">
          <div className="border-b border-[#EBEBEA] px-4 py-3">
            <p className="font-body text-[11px] uppercase tracking-[0.08em] text-[#6B6B68]">Pending Invitations</p>
          </div>
          <table className="w-full min-w-[840px]">
            <thead className="border-b border-[#EBEBEA] bg-[#FAFAFA]">
              <tr className="font-body text-[10px] uppercase tracking-[0.08em] text-[#6B6B68]">
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Invited By</th>
                <th className="px-3 py-2 text-left">Expires</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id} className="border-b border-[#F5F5F3]">
                  <td className="px-3 py-3 font-body text-sm text-ink">{invitation.email}</td>
                  <td className="px-3 py-3 font-body text-xs text-[#6B6B68]">{invitation.role}</td>
                  <td className="px-3 py-3 font-body text-xs text-[#6B6B68]">{invitation.invitedBy}</td>
                  <td className="px-3 py-3 font-body text-xs text-[#6B6B68]">{new Date(invitation.expiresAt).toLocaleString("en-GB")}</td>
                  <td className="px-3 py-3 text-right">
                    <button type="button" onClick={() => void resendInvite(invitation.token)} className="mr-3 font-body text-xs text-[#37392d] hover:underline">
                      Resend
                    </button>
                    <button type="button" onClick={() => void cancelInvite(invitation.token)} className="font-body text-xs text-red-600 hover:underline">
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <InviteAdminModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSent={() => {
          void reload();
        }}
      />
    </div>
  );
}
