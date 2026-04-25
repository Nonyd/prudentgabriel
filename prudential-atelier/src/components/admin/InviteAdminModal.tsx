"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Role } from "@prisma/client";

export function InviteAdminModal({
  open,
  onOpenChange,
  onSent,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSent: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [message, setMessage] = useState("");

  async function submit() {
    const response = await fetch("/api/admin/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, message: message || undefined }),
    });
    if (!response.ok) return;
    setEmail("");
    setRole("ADMIN");
    setMessage("");
    onOpenChange(false);
    onSent();
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 border border-[#EBEBEA] bg-white">
          <div className="border-b border-[#EBEBEA] px-5 py-4">
            <Dialog.Title className="font-display text-[22px] text-ink">Invite Team Member</Dialog.Title>
          </div>
          <div className="space-y-4 px-5 py-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <label className="border border-[#EBEBEA] px-3 py-2">
                <input type="radio" checked={role === "ADMIN"} onChange={() => setRole("ADMIN")} />{" "}
                <span className="font-body text-sm">Admin</span>
              </label>
              <label className="border border-[#EBEBEA] px-3 py-2">
                <input type="radio" checked={role === "SUPER_ADMIN"} onChange={() => setRole("SUPER_ADMIN")} />{" "}
                <span className="font-body text-sm">Super Admin</span>
              </label>
            </div>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} placeholder="Add a personal note to the invitation email..." className="h-20 w-full border border-[#EBEBEA] px-3 py-2 font-body text-sm" />
            <div className="border border-[#EBEBEA] bg-[#FAFAF8] p-4">
              <p className="mb-2 font-body text-xs text-[#6B6B68]">The invitation email will look like this:</p>
              <div className="border border-[#EBEBEA] bg-white p-3 font-body text-xs text-[#4A4A47]">
                You&apos;ve been invited to join Prudent Gabriel Admin Portal as {role}.
                {message ? <p className="mt-2">{message}</p> : null}
                <p className="mt-2 text-[#37392d]">[Accept Invitation →]</p>
                <p className="mt-1">Link expires in 72 hours.</p>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#EBEBEA] px-5 py-3">
            <button type="button" onClick={() => onOpenChange(false)} className="border border-[#EBEBEA] px-4 py-2 font-body text-xs">Cancel</button>
            <button type="button" onClick={() => void submit()} className="bg-[#37392d] px-4 py-2 font-body text-xs text-white">Send Invitation</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
