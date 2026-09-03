"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";

type Prefs = {
  orderStage: boolean;
  newCollections: boolean;
  wishlistRestock: boolean;
  eventReminders: boolean;
};

export function SettingsClient({
  initial,
  prefs: initialPrefs,
}: {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    image: string | null;
  };
  prefs: Prefs;
}) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [image, setImage] = useState(initial.image ?? "");
  const [prefs, setPrefs] = useState(initialPrefs);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  async function saveProfile() {
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, phone, image: image || "" }),
    });
    if (res.ok) toast.success("Profile updated");
    else toast.error("Update failed");
  }

  async function savePrefs() {
    const res = await fetch("/api/account/profile/merged", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPrefs: prefs }),
    });
    if (res.ok) toast.success("Preferences saved");
    else toast.error("Save failed");
  }

  async function changePassword() {
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    if (res.ok) {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const j = (await res.json()) as { error?: string };
      toast.error(typeof j.error === "string" ? j.error : "Password change failed");
    }
  }

  async function deleteAccount() {
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else toast.error("Could not delete account");
  }

  async function uploadPhoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/account/upload", { method: "POST", body: fd });
    if (!res.ok) return toast.error("Upload failed");
    const j = (await res.json()) as { url: string };
    setImage(j.url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <h1 className="font-display text-4xl text-choc">Account Settings</h1>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Personal Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block font-sans text-sm">
            First name
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full border border-sand px-3 py-2"
            />
          </label>
          <label className="block font-sans text-sm">
            Last name
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full border border-sand px-3 py-2"
            />
          </label>
          <label className="block font-sans text-sm sm:col-span-2">
            Email (read-only)
            <input value={initial.email} disabled className="mt-1 w-full border border-sand bg-bg px-3 py-2" />
          </label>
          <label className="block font-sans text-sm sm:col-span-2">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full border border-sand px-3 py-2"
            />
          </label>
          <label className="block font-sans text-sm sm:col-span-2">
            Profile photo
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
              className="mt-1 w-full font-sans text-sm"
            />
          </label>
        </div>
        <button type="button" onClick={saveProfile} className="btn-primary mt-6">
          Save
        </button>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Password</h2>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-sand px-3 py-2 font-sans text-sm"
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-sand px-3 py-2 font-sans text-sm"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-sand px-3 py-2 font-sans text-sm"
          />
        </div>
        <button type="button" onClick={changePassword} className="btn-primary mt-6">
          Update password
        </button>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Notification Preferences</h2>
        <ul className="mt-4 space-y-3 font-sans text-sm">
          {(
            [
              ["orderStage", "Email me when my order advances a stage"],
              ["newCollections", "Email me about new collections"],
              ["wishlistRestock", "Email me when wishlisted items restock"],
              ["eventReminders", "Email me 60 days, 30 days, and 14 days before my saved event dates"],
            ] as const
          ).map(([key, label]) => (
            <li key={key}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {label}
              </label>
            </li>
          ))}
        </ul>
        <button type="button" onClick={savePrefs} className="btn-primary mt-6">
          Save preferences
        </button>
      </section>

      <section className="rounded-lg border border-red-200 bg-red-50/50 p-6">
        <h2 className="font-display text-xl text-red-800">Danger Zone</h2>
        <p className="mt-2 font-sans text-sm text-red-700">
          Permanently deactivate your account. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-4 border border-red-600 px-4 py-2 font-sans text-xs text-red-600"
        >
          Delete my account
        </button>
      </section>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-ivory p-6">
            <p className="font-sans text-sm">Type DELETE to confirm account deletion.</p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="mt-3 w-full border border-sand px-3 py-2"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteOpen(false)} className="btn-ghost-light">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirm !== "DELETE"}
                onClick={deleteAccount}
                className="border border-red-600 px-4 py-2 text-red-600"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
