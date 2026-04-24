"use client";

import { useState } from "react";
import toast from "react-hot-toast";

export function ProfileFormClient({
  initial,
}: {
  initial: { firstName: string; lastName: string; email: string; phone: string; image: string };
}) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveProfile} className="mt-8 space-y-4 rounded-sm border border-border bg-cream p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-charcoal-mid">First name</span>
          <input
            className="mt-1 w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-charcoal-mid">Last name</span>
          <input
            className="mt-1 w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-charcoal-mid">Email (locked)</span>
        <input className="mt-1 w-full cursor-not-allowed opacity-60" value={initial.email} readOnly disabled />
      </label>
      <label className="block text-sm">
        <span className="text-charcoal-mid">Phone</span>
        <input
          className="mt-1 w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded-sm bg-wine px-6 py-2 text-sm text-ivory hover:bg-wine-hover disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>

      <PasswordSection />
    </form>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (!res.ok) throw new Error();
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Could not update password");
    } finally {
      setBusy(false);
    }
  }

  const strength =
    newPassword.length >= 12 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /\d/.test(newPassword)
      ? "strong"
      : newPassword.length >= 8
        ? "fair"
        : "weak";

  return (
    <div className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-lg text-charcoal">Change password</h2>
      <form onSubmit={changePassword} className="mt-4 space-y-3">
        <input
          type="password"
          placeholder="Current password"
          className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password"
          className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p
          className={
            strength === "strong" ? "text-xs text-success" : strength === "fair" ? "text-xs text-warning" : "text-xs text-error"
          }
        >
          {strength === "strong" ? "Strong" : strength === "fair" ? "Fair" : "Weak"}
        </p>
        <input
          type="password"
          placeholder="Confirm new password"
          className="w-full border-b border-border bg-transparent py-2 outline-none focus:border-wine"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-sm border border-wine px-6 py-2 text-sm text-wine hover:bg-wine/5 disabled:opacity-50"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
