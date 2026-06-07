"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  PERMISSION_GROUPS,
  ROLE_PRESETS,
  type Permission,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

type JobRoleRow = {
  id: string;
  name: string;
  description: string | null;
  isPreset: boolean;
  permissions: string[];
  staffCount: number;
  permissionCount: number;
};

function RoleFormModal({
  open,
  onClose,
  role,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  role: JobRoleRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [presetKey, setPresetKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setPermissions(role?.permissions ?? []);
    setPresetKey("");
  }, [open, role]);

  const togglePermission = (key: Permission) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key],
    );
  };

  const applyPreset = (key: string) => {
    setPresetKey(key);
    const preset = ROLE_PRESETS[key];
    if (!preset) return;
    setName(preset.name);
    setDescription(preset.description);
    setPermissions(preset.permissions);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSubmitting(true);
    try {
      const url = role ? `/api/admin/job-roles/${role.id}` : "/api/admin/job-roles";
      const method = role ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          permissions,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success(role ? "Role updated" : "Role created");
      onClose();
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={role ? "Edit Job Role" : "New Job Role"}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {!role ? (
          <div>
            <label className="mb-2 block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
              Start from a template
            </label>
            <select
              value={presetKey}
              onChange={(e) => applyPreset(e.target.value)}
              className="w-full rounded-[3px] border border-sand bg-bg-card px-3 py-2.5 font-sans text-sm"
            >
              <option value="">— Custom role —</option>
              {Object.entries(ROLE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className="mb-2 block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Role name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-3 py-2.5 font-sans text-sm"
            placeholder="e.g. Head Beader"
          />
        </div>

        <div>
          <label className="mb-2 block font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-3 py-2.5 font-sans text-sm"
          />
        </div>

        <div className="space-y-4">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
            Permissions
          </p>
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 font-sans text-xs font-semibold text-ink">{group.label}</p>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <label key={item.key} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={permissions.includes(item.key)}
                      onChange={() => togglePermission(item.key)}
                      className="mt-0.5"
                    />
                    <span className="font-sans text-sm text-text-mid">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save role"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function JobRolesClient() {
  const [roles, setRoles] = useState<JobRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobRoleRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/job-roles");
      if (!res.ok) {
        toast.error("Failed to load job roles");
        return;
      }
      const data = (await res.json()) as { items: JobRoleRow[] };
      setRoles(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...roles].sort((a, b) => a.name.localeCompare(b.name)),
    [roles],
  );

  const remove = async (role: JobRoleRow) => {
    if (role.staffCount > 0) {
      toast.error("Remove staff from this role before deleting");
      return;
    }
    if (!confirm(`Delete role "${role.name}"?`)) return;
    setDeletingId(role.id);
    try {
      const res = await fetch(`/api/admin/job-roles/${role.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Delete failed");
        return;
      }
      toast.success("Role deleted");
      void load();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="font-display text-2xl text-ink">Job Roles</h1>
          <p className="mt-1 font-sans text-sm text-text-mid">
            Flexible permissions for staff and admin users
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New Role
        </Button>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-text-mid">Loading roles…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((role) => (
            <div
              key={role.id}
              className="rounded-lg border border-sand bg-bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl text-ink">{role.name}</h2>
                {role.isPreset ? <Badge variant="gold">PRESET</Badge> : null}
              </div>
              {role.description ? (
                <p className="mt-2 font-serif text-[13px] leading-relaxed text-text-mid">
                  {role.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline-gold">{role.permissionCount} permissions</Badge>
                <Badge variant="grey">{role.staffCount} staff members</Badge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(role);
                    setModalOpen(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={role.staffCount > 0 || deletingId === role.id}
                  onClick={() => void remove(role)}
                  className={cn(role.staffCount > 0 && "opacity-50")}
                >
                  {deletingId === role.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <RoleFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        role={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
