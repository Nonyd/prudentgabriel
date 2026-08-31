"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { uploadAdminAsset } from "@/lib/admin-upload-xhr";
import { getInitials } from "@/lib/utils";

type Props = {
  initial: { name: string; email: string; image: string };
  canChangeEmail?: boolean;
};

export function AdminAccountSettingsClient({ initial, canChangeEmail = false }: Props) {
  const { update } = useSession();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [savedEmail, setSavedEmail] = useState(initial.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [image, setImage] = useState(initial.image);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const nextEmail = email.trim().toLowerCase();
    const changingEmail = canChangeEmail && nextEmail !== savedEmail.toLowerCase();
    if (changingEmail && !emailPassword) {
      toast.error("Enter your current password to change email");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(changingEmail
            ? { email: nextEmail, currentPassword: emailPassword }
            : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; name?: string; email?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      const nextName = data.name ?? name.trim();
      const persistedEmail = data.email ?? nextEmail;
      setName(nextName);
      setEmail(persistedEmail);
      setSavedEmail(persistedEmail);
      setEmailPassword("");
      await update({ name: nextName, email: persistedEmail, image });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarPick(file: File) {
    setUploading(true);
    try {
      const url = await uploadAdminAsset(file, "prudential-atelier/avatars/admin", (pct) => {
        if (pct >= 100) setUploading(true);
      });
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: url }),
      });
      const data = (await res.json()) as { error?: string; image?: string | null };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      setImage(url);
      await update({ name, image: url });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords must match");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : typeof data.error === "object" && data.error !== null
              ? "Please check your password fields"
              : "Could not update password";
        throw new Error(msg);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-lightbr">Account</p>
        <h1 className="mt-2 font-serif text-3xl font-normal text-choc">Account Settings</h1>
        <p className="mt-2 font-body text-sm text-text-mid">Manage your personal profile and sign-in credentials.</p>
      </div>

      <section className="card-surface p-6">
        <h2 className="font-serif text-lg font-medium text-choc">Profile photo</h2>
        <p className="mt-1 font-sans text-xs text-text-mid">Shown in the admin sidebar and across the operations suite.</p>
        <div className="mt-5 flex items-center gap-5">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sand/50 font-sans text-lg font-medium text-choc">
            {image ? (
              <Image src={image} alt="" fill className="object-cover" sizes="80px" unoptimized />
            ) : (
              getInitials(name || email)
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onAvatarPick(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="secondary"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
          </div>
        </div>
      </section>

      <form onSubmit={saveProfile} className="card-surface space-y-5 p-6">
        <div>
          <h2 className="font-serif text-lg font-medium text-choc">Personal information</h2>
          <p className="mt-1 font-sans text-xs text-text-mid">Your display name appears in the sidebar and daily report greeting.</p>
        </div>
        <label className="block">
          <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
            Full name
          </span>
          <input
            className="input-field w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
            Email
          </span>
          <input
            type="email"
            className={
              canChangeEmail
                ? "input-field w-full"
                : "input-field w-full cursor-not-allowed opacity-60"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={!canChangeEmail}
            disabled={!canChangeEmail}
            required
          />
          {canChangeEmail ? (
            <p className="mt-1.5 font-sans text-[11px] text-text-mid">
              Changing this email updates how you sign in. Confirm with your current password below.
            </p>
          ) : null}
        </label>
        {canChangeEmail && email.trim().toLowerCase() !== savedEmail.toLowerCase() ? (
          <label className="block">
            <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
              Current password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              className="input-field w-full"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
            />
          </label>
        ) : null}
        <Button type="submit" loading={savingProfile}>
          Save changes
        </Button>
      </form>

      <form onSubmit={savePassword} className="card-surface space-y-5 p-6">
        <div>
          <h2 className="font-serif text-lg font-medium text-choc">Password</h2>
          <p className="mt-1 font-sans text-xs text-text-mid">Minimum 8 characters. Use a unique password for this account.</p>
        </div>
        <label className="block">
          <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
            Current password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            className="input-field w-full"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
            New password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className="input-field w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="block">
          <span className="mb-2 block font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-text-mid">
            Confirm new password
          </span>
          <input
            type="password"
            autoComplete="new-password"
            className="input-field w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <Button type="submit" loading={savingPassword}>
          Update password
        </Button>
      </form>
    </div>
  );
}
