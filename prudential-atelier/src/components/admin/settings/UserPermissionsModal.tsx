"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { KEMI_EMAIL } from "@/lib/permission-catalog";
import { displayRoleLabel } from "@/lib/admin-users";
import { PermissionHistory } from "./PermissionHistory";

type PermItem = {
  key: string;
  label: string;
  description: string;
  group: string;
  effective: boolean;
  source: "from_role" | "granted" | "revoked" | "super_admin";
  fromRole: boolean;
};

type DriftItem = { permission: string; count: number; emails: string[] };

function sourceLabel(source: PermItem["source"]) {
  if (source === "granted") return "Granted";
  if (source === "revoked") return "Revoked";
  if (source === "super_admin") return "Super Admin";
  return "From role";
}

export function UserPermissionsModal({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [items, setItems] = useState<PermItem[]>([]);
  const [overrides, setOverrides] = useState<Map<string, "GRANT" | "REVOKE">>(new Map());
  const [editable, setEditable] = useState<{ ok: boolean; reason?: string }>({ ok: true });
  const [drift, setDrift] = useState<DriftItem[]>([]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [userRes, driftRes] = await Promise.all([
        fetch(`/api/admin/permissions/users/${id}`),
        fetch("/api/admin/permissions/drift"),
      ]);
      if (!userRes.ok) {
        toast.error("Failed to load permissions");
        return;
      }
      const data = (await userRes.json()) as {
        user: { name: string | null; email: string; role: string };
        items: PermItem[];
        grants: string[];
        revokes: string[];
        editable: { ok: true } | { ok: false; reason: string };
      };
      setName(data.user.name);
      setEmail(data.user.email);
      setRole(data.user.role);
      setItems(data.items);
      setEditable(data.editable);
      const next = new Map<string, "GRANT" | "REVOKE">();
      for (const g of data.grants) next.set(g, "GRANT");
      for (const r of data.revokes) next.set(r, "REVOKE");
      setOverrides(next);
      if (driftRes.ok) {
        const d = (await driftRes.json()) as { items: DriftItem[] };
        setDrift(d.items ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !userId) return;
    void load(userId);
  }, [open, userId, load]);

  if (!userId) return null;

  const toggle = (item: PermItem) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      const current = next.get(item.key);
      if (item.fromRole) {
        if (current === "REVOKE") next.delete(item.key);
        else next.set(item.key, "REVOKE");
      } else if (current === "GRANT") {
        next.delete(item.key);
      } else {
        next.set(item.key, "GRANT");
      }
      return next;
    });
  };

  const isOn = (item: PermItem) => {
    const mode = overrides.get(item.key);
    if (mode === "GRANT") return true;
    if (mode === "REVOKE") return false;
    return item.fromRole;
  };

  const sourceNow = (item: PermItem): PermItem["source"] => {
    const mode = overrides.get(item.key);
    if (mode === "GRANT") return "granted";
    if (mode === "REVOKE") return "revoked";
    return "from_role";
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/permissions/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: Array.from(overrides.entries()).map(([permission, mode]) => ({ permission, mode })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success("Overrides saved");
      await load(userId);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/permissions/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) {
        toast.error("Could not reset");
        return;
      }
      toast.success("Reset to role defaults");
      await load(userId);
    } finally {
      setSaving(false);
    }
  };

  const matchingDrift = drift.filter((d) => d.emails.includes(email) && d.count >= 2);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={name ? `${name}` : "Permissions"}
      description={email ? `${email} · ${displayRoleLabel(role)}` : undefined}
      className="max-h-[90vh] max-w-2xl overflow-y-auto"
    >
      {loading ? (
        <p className="mt-6 font-sans text-sm text-text-mid">Loading…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {email.toLowerCase() === KEMI_EMAIL ? (
            <p className="border border-sand bg-bg/40 p-3 font-sans text-xs text-text-mid">
              Kemi is the acceptance case: grant atelier (bespoke and consultations) on top of RTW
              Manager. She must still be denied payments, settings, developer, and users.
            </p>
          ) : null}

          {!editable.ok ? (
            <p className="font-sans text-sm text-text-mid">{editable.reason}</p>
          ) : (
            <>
              {matchingDrift.map((d) => (
                <p key={d.permission} className="font-sans text-xs text-text-mid">
                  {d.count} people carry a {d.permission} grant, including this account. The role may
                  be wrong.
                </p>
              ))}

              <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => (
                  <li key={item.key} className="flex items-start gap-3 border-b border-sand/70 py-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-nut"
                      checked={isOn(item)}
                      onChange={() => toggle(item)}
                      id={`user-perm-${item.key}`}
                    />
                    <label htmlFor={`user-perm-${item.key}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-sm text-text-dark">{item.label}</span>
                        <Badge
                          size="sm"
                          variant={
                            sourceNow(item) === "granted"
                              ? "success"
                              : sourceNow(item) === "revoked"
                                ? "wine"
                                : "grey"
                          }
                        >
                          {sourceLabel(sourceNow(item))}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block font-sans text-xs font-light text-text-mid">
                        {item.description}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost-light" onClick={() => void reset()} loading={saving}>
                  Reset to role defaults
                </Button>
                <Button type="button" onClick={() => void save()} loading={saving}>
                  Save overrides
                </Button>
              </div>
            </>
          )}

          <PermissionHistory recordId={userId} recordType="User" />
        </div>
      )}
    </Modal>
  );
}
