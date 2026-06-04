"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function StaffProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const changePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not update password");
        return;
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await update({});
    } finally {
      setSaving(false);
    }
  };

  const jobTitle = (user as { jobTitle?: string } | undefined)?.jobTitle;
  const department = (user as { department?: string } | undefined)?.department;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Profile</h1>

      <div className="rounded-lg border border-sand bg-white p-4">
        <p className="font-display text-xl text-ink">{user?.name ?? "Staff member"}</p>
        <p className="mt-1 font-sans text-sm text-text-mid">{user?.email}</p>
        {jobTitle ? (
          <p className="mt-3 font-sans text-sm text-ink">{jobTitle}</p>
        ) : null}
        {department ? <Badge variant="outline-gold">{department}</Badge> : null}
      </div>

      <div className="rounded-lg border border-sand bg-white p-4 space-y-3">
        <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
          Change password
        </h2>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-[3px] border border-sand px-3 py-2 font-sans text-sm"
        />
        <Button onClick={() => void changePassword()} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
        </Button>
      </div>
    </div>
  );
}
