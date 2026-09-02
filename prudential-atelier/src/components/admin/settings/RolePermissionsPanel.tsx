"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ADMIN_PERMISSION_CATALOG,
  type PermissionCatalogEntry,
  type RolePermissionProposal,
} from "@/lib/permission-catalog";
import { displayRoleLabel } from "@/lib/admin-users";
import { PermissionHistory } from "./PermissionHistory";

type RoleRow = {
  role: string;
  label: string;
  memberCount: number;
  permissions: string[] | "*";
  editable: boolean;
  proposals: RolePermissionProposal[];
};

function groupedCatalog() {
  const groups: { name: string; entries: PermissionCatalogEntry[] }[] = [];
  for (const entry of ADMIN_PERMISSION_CATALOG) {
    if (entry.superAdminOnly) continue;
    const current = groups.find((g) => g.name === entry.group);
    if (current) current.entries.push(entry);
    else groups.push({ name: entry.group, entries: [entry] });
  }
  return groups;
}

export function RolePermissionsPanel() {
  const [items, setItems] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("RTW_MANAGER");
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/permissions/roles");
    if (!res.ok) {
      toast.error("Failed to load roles");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { items: RoleRow[] };
    setItems(data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const current = items.find((i) => i.role === selected);

  useEffect(() => {
    if (!current || current.permissions === "*") return;
    setDraft(new Set(current.permissions));
    setConfirming(false);
  }, [current?.role, current?.permissions]);

  const groups = useMemo(() => groupedCatalog(), []);
  const dirty =
    current &&
    current.permissions !== "*" &&
    (draft.size !== current.permissions.length || current.permissions.some((p) => !draft.has(p)));

  const save = async () => {
    if (!current?.editable) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/permissions/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: current.role, permissions: Array.from(draft) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Save failed");
        return;
      }
      toast.success(`Updated ${current.label}`);
      setConfirming(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const applyProposal = (proposal: RolePermissionProposal) => {
    setDraft((prev) => {
      const next = new Set(prev);
      for (const p of proposal.add) next.add(p);
      return next;
    });
    setDismissed((prev) => new Set(prev).add(proposal.id));
  };

  const preview = async () => {
    if (!current) return;
    const res = await fetch("/api/admin/permissions/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: current.role }),
    });
    if (!res.ok) {
      toast.error("Could not start preview");
      return;
    }
    window.location.href = "/admin";
  };

  if (loading) {
    return <p className="font-sans text-sm text-text-mid">Loading roles…</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <ul className="space-y-1">
        {items.map((row) => (
          <li key={row.role}>
            <button
              type="button"
              onClick={() => setSelected(row.role)}
              className={`flex w-full items-center justify-between rounded-[3px] px-3 py-2 text-left font-sans text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc ${
                selected === row.role ? "bg-choc/10 text-choc" : "text-text-dark hover:bg-sand/40"
              }`}
            >
              <span>{row.label}</span>
              <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-text-mid">
                {row.memberCount}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {current ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-choc">{current.label}</h2>
              <p className="mt-1 font-sans text-sm text-text-mid">
                {current.memberCount === 0
                  ? "Nobody holds this role yet."
                  : current.memberCount === 1
                    ? "1 account holds this role. Saving changes them."
                    : `${current.memberCount} accounts hold this role. Saving changes all of them.`}
              </p>
            </div>
            {current.editable && current.role !== "STAFF" ? (
              <Button type="button" variant="ghost-light" size="sm" onClick={() => void preview()}>
                View the dashboard as this role
              </Button>
            ) : null}
          </div>

          {!current.editable ? (
            <p className="border border-sand bg-bg/40 p-4 font-sans text-sm text-text-mid">
              Super Admin always holds every permission. It cannot be edited — one bad save would
              remove the only role that can restore it.
            </p>
          ) : (
            <>
              {current.proposals
                .filter((p) => !dismissed.has(p.id))
                .map((proposal) => (
                  <div key={proposal.id} className="border border-sand bg-ivory p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={proposal.kind === "regression" ? "wine" : proposal.kind === "split" ? "gold" : "grey"}
                        size="sm"
                      >
                        {proposal.kind === "regression" ? "Regression" : proposal.kind === "split" ? "Split" : "Gap"}
                      </Badge>
                      <p className="font-sans text-sm font-medium text-text-dark">{proposal.title}</p>
                    </div>
                    <p className="mt-2 font-sans text-sm font-light text-text-mid">{proposal.reason}</p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" onClick={() => applyProposal(proposal)}>
                        Propose in draft
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost-light"
                        onClick={() => setDismissed((prev) => new Set(prev).add(proposal.id))}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}

              {groups.map((group) => (
                <div key={group.name}>
                  <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-mid">
                    {group.name}
                  </p>
                  <ul className="space-y-2">
                    {group.entries.map((entry) => (
                      <li key={entry.key} className="flex items-start gap-3 border-b border-sand/70 py-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-nut"
                          checked={draft.has(entry.key)}
                          onChange={(e) => {
                            setDraft((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(entry.key);
                              else next.delete(entry.key);
                              return next;
                            });
                            setConfirming(false);
                          }}
                          id={`perm-${entry.key}`}
                        />
                        <label htmlFor={`perm-${entry.key}`} className="min-w-0 cursor-pointer">
                          <span className="font-sans text-sm text-text-dark">{entry.label}</span>
                          <span className="mt-0.5 block font-sans text-xs font-light text-text-mid">
                            {entry.description}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" loading={saving} disabled={!dirty} onClick={() => void save()}>
                  {confirming
                    ? `Save for ${current.memberCount} account${current.memberCount === 1 ? "" : "s"}`
                    : "Save role"}
                </Button>
                {confirming ? (
                  <p className="font-sans text-xs text-text-mid">
                    This changes {displayRoleLabel(current.role)} for everyone on it.
                  </p>
                ) : null}
              </div>
            </>
          )}

          <PermissionHistory recordId={current.role} recordType="Role" />
        </div>
      ) : null}
    </div>
  );
}
