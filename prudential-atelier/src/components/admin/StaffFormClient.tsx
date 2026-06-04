"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export function StaffFormClient() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "TAILOR",
    employmentType: "EMPLOYEE",
    skillTags: "",
    isActive: true,
  });

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
      const data = (await res.json()) as { item?: { id: string }; tempPassword?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create staff member");
        return;
      }
      toast.success("Staff member created");
      if (data.tempPassword) setTempPassword(data.tempPassword);
      else if (data.item?.id) router.push(`/admin/staff/${data.item.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/staff"
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Staff directory
        </Link>
        <h1 className="mt-2 font-display text-2xl text-ink">Add Staff Member</h1>
        <p className="mt-1 font-sans text-sm text-text-mid">
          Creates a staff account with a temporary password
        </p>
      </div>

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
            Create Staff
          </Button>
        </div>
      </form>

      <Modal
        open={!!tempPassword}
        onClose={() => {
          setTempPassword(null);
          router.push("/admin/staff");
        }}
        title="Staff account created"
        description="Share this temporary password securely. The staff member should change it on first login."
      >
        <p className="mt-4 rounded border border-sand bg-bg px-4 py-3 font-mono text-sm text-choc">
          {tempPassword}
        </p>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => {
              setTempPassword(null);
              router.push("/admin/staff");
            }}
          >
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
