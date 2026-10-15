"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { NETWORK_ERROR_MESSAGE, authResponseMessage, submitPasswordChange } from "@/lib/client-auth";
import toast from "react-hot-toast";
import { PasswordField } from "@/components/ui/PasswordField";
import { BirthdayField } from "@/components/common/BirthdayField";
import { UploadProgressBar } from "@/components/ui/UploadProgressBar";
import { xhrPostFormData } from "@/lib/admin-upload-xhr";
import { MARKETING_CONSENT_LABEL } from "@/lib/marketing-consent-copy";

type MarketingState = { optedIn: boolean; consentAt: string | null; source: string | null };

type Prefs = {
  orderStage: boolean;
  newCollections: boolean;
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
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const [marketing, setMarketing] = useState<MarketingState | null>(null);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/account/marketing")
      .then((r) => (r.ok ? (r.json() as Promise<MarketingState>) : null))
      .then((j) => {
        if (live && j) setMarketing(j);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function setMarketingConsent(optIn: boolean) {
    setMarketingSaving(true);
    try {
      const res = await fetch("/api/account/marketing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn }),
      });
      if (!res.ok) {
        toast.error(await authResponseMessage(res, "Could not save your choice."));
        return;
      }
      setMarketing((await res.json()) as MarketingState);
      toast.success(optIn ? "You will hear about new collections and private events" : "Marketing emails turned off");
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setMarketingSaving(false);
    }
  }

  async function downloadData() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        toast.error(await authResponseMessage(res, "Could not prepare your data."));
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "prudent-gabriel-data.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
    } finally {
      setExporting(false);
    }
  }

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
    const result = await submitPasswordChange("/api/account/password", { currentPassword, newPassword, confirmPassword });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
      toast.success("Password updated. Please sign in with your new password.");
      // The change ended every session, this one included: sign out cleanly.
      await signOut({ callbackUrl: "/auth/login?reason=password-changed" });
  }

  async function deleteAccount() {
    let res: Response;
    try {
      res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
    } catch {
      toast.error(NETWORK_ERROR_MESSAGE);
      return;
    }
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else toast.error(await authResponseMessage(res, "Could not close your account."));
  }

  async function uploadPhoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setPhotoProgress(0);
    try {
      const j = (await xhrPostFormData("/api/account/upload", fd, {
        onProgress: setPhotoProgress,
        credentials: true,
      })) as { url: string };
      setImage(j.url);
    } catch {
      toast.error("Upload failed");
    } finally {
      setPhotoProgress(null);
    }
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
          <div className="sm:col-span-2">
            <label className="block font-sans text-sm">
              Profile photo
              <input
                type="file"
                accept="image/*"
                disabled={photoProgress !== null}
                onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                className="mt-1 w-full font-sans text-sm"
              />
            </label>
            <UploadProgressBar value={photoProgress} label="Photo" tone="storefront" className="mt-2" />
          </div>
        </div>
        <button type="button" onClick={saveProfile} className="btn-primary mt-6">
          Save
        </button>
      </section>

      <section className="card-surface p-6">
        <BirthdayField tone="storefront" />
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Password</h2>
        <div className="mt-4 space-y-3">
          <PasswordField
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-sand px-3 py-2 font-sans text-sm"
          />
          <PasswordField
            placeholder="New password (min 8 chars)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full border border-sand px-3 py-2 font-sans text-sm"
          />
          <PasswordField
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
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

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Marketing emails</h2>
        <label className="mt-4 flex items-start gap-3 font-sans text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={marketing?.optedIn ?? false}
            disabled={marketing === null || marketingSaving}
            onChange={(e) => void setMarketingConsent(e.target.checked)}
          />
          <span>{MARKETING_CONSENT_LABEL}</span>
        </label>
        <p className="mt-2 font-sans text-xs text-text-mid">
          {marketing?.optedIn && marketing.consentAt
            ? `On since ${new Date(marketing.consentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`
            : "Off. Emails about your orders, bookings and account still reach you."}
        </p>
      </section>

      <section className="card-surface p-6">
        <h2 className="font-display text-xl text-choc">Your data</h2>
        <p className="mt-2 font-sans text-sm text-text-mid">
          Download a copy of the personal data we hold about you: your profile, addresses, measurements,
          orders, payments, bookings, commissions, reviews, points and chats.
        </p>
        <button
          type="button"
          onClick={() => void downloadData()}
          disabled={exporting}
          className="btn-primary mt-4 disabled:opacity-60"
        >
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </section>

      <section className="rounded-lg border border-error/30 bg-error-soft p-6">
        <h2 className="font-display text-xl text-error">Danger Zone</h2>
        <p className="mt-2 font-sans text-sm text-error">
          Close your account and erase your personal details: addresses, measurements, style profile,
          moodboards, event dates, wishlist, saved cards, chats and marketing preferences. Orders,
          payments, invoices and commission records are kept, as the law requires us to keep
          financial records. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-4 border border-red-600 px-4 py-2 font-sans text-xs text-error"
        >
          Delete my account
        </button>
      </section>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-ivory p-6">
            <p className="font-sans text-sm">
              Type DELETE to close your account. You may want to download your data first.
            </p>
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
                className="border border-red-600 px-4 py-2 text-error"
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
