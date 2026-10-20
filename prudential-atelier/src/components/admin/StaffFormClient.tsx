"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  department: "TAILOR",
  employmentType: "EMPLOYEE",
  skillTags: "",
  isActive: true,
};

/**
 * Invite a staff member. Open to anyone with "Invite staff" (or Staff). It only
 * ever creates a Staff account, and the person sets their own password from
 * the emailed link.
 */
export function StaffFormClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [invited, setInvited] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          department: form.department,
          employmentType: form.employmentType,
          skillTags: form.skillTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isActive: form.isActive,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        item?: { id: string };
        invitedEmail?: string;
        canOpenProfile?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Could not invite this staff member");
        return;
      }
      toast.success(`Invitation sent to ${data.invitedEmail ?? form.email}`);
      if (data.canOpenProfile && data.item?.id) {
        router.push(`/admin/staff/${data.item.id}`);
        return;
      }
      setInvited(data.invitedEmail ?? form.email);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/staff"
          className="font-sans text-10px font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Staff directory
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">Invite a staff member</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Creates a staff account and emails them a link to choose their password. Admins are added by the
          Super Admin in Users &amp; Roles.
        </p>
      </div>

      {invited ? (
        <p className="card-surface p-4 font-sans text-sm text-choc" role="status">
          Invitation sent to {invited}. The link works once, for seven days.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="card-surface space-y-4 p-6">
        {(
          [
            ["name", "Full name", "text", true],
            ["email", "Email", "email", true],
            ["phone", "Phone", "tel", false],
          ] as const
        ).map(([key, label, type, required]) => (
          <label key={key} className="block">
            <span className="mb-1 block font-sans text-xs font-medium text-text-mid">{label}</span>
            <input
              type={type}
              required={required}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-1 block font-sans text-xs font-medium text-text-mid">Department</span>
          <select
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
          >
            {["TAILOR", "BEADER", "DESIGNER", "PATTERN_CUTTER", "GENERAL"].map((d) => (
              <option key={d} value={d}>
                {d.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-sans text-xs font-medium text-text-mid">
            Employment type
          </span>
          <select
            value={form.employmentType}
            onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
            className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="FREELANCER">Freelancer</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-sans text-xs font-medium text-text-mid">
            Skill tags (comma-separated)
          </span>
          <input
            type="text"
            value={form.skillTags}
            onChange={(e) => setForm((f) => ({ ...f, skillTags: e.target.value }))}
            placeholder="beading, bridal, menswear"
            className="w-full rounded border border-sand px-3 py-2 font-sans text-sm"
          />
        </label>

        <label className="flex items-center gap-2 font-sans text-sm text-text-mid">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active staff member
        </label>

        <div className="flex justify-end gap-2 pt-4">
          <Link href="/admin/staff">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
          <Button type="submit" loading={saving}>
            Send invitation
          </Button>
        </div>
      </form>
    </div>
  );
}
