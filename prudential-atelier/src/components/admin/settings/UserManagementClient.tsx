"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { Loader2, Lock, Pencil, Trash2, UserMinus } from "lucide-react";
import toast from "react-hot-toast";
import { BulkSelectTable, type BulkColumn } from "@/components/ui/BulkSelectTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  displayRoleLabel,
  INVITE_ROLE_LABELS,
  INVITE_ROLES,
  MANAGED_STAFF_ROLES,
  roleBadgeVariant,
} from "@/lib/admin-users";
import { cn, formatDate, getInitials } from "@/lib/utils";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  isProtected: boolean;
};

function AvatarInitials({ name, email }: { name: string | null; email: string }) {
  const label = name?.trim() || email;
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-choc/10 font-sans text-[10px] font-semibold uppercase tracking-wide text-choc">
      {getInitials(label)}
    </span>
  );
}

function InviteUserModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState<"admin" | "staff">("admin");
  const [jobRoleId, setJobRoleId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [jobRoles, setJobRoles] = useState<{ id: string; name: string; permissionCount: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/admin/job-roles")
      .then((r) => r.json())
      .then((d) => {
        const items = (d as { items: { id: string; name: string; permissionCount: number }[] }).items ?? [];
        setJobRoles(items);
        if (items[0] && !jobRoleId) setJobRoleId(items[0].id);
      });
  }, [open, jobRoleId]);

  const selectedRole = jobRoles.find((r) => r.id === jobRoleId);

  const reset = () => {
    setName("");
    setEmail("");
    setUserType("admin");
    setJobRoleId("");
    setJobTitle("");
    setDepartment("");
  };

  const submit = async () => {
    if (!name.trim() || !email.trim() || !jobRoleId) {
      toast.error("Name, email, and job role are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          userType,
          jobRoleId,
          jobTitle: jobTitle.trim() || undefined,
          department: department.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to invite user");
        return;
      }
      toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
      reset();
      onClose();
      onSent();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite User" className="max-w-lg">
      <div className="mt-6 space-y-4">
        <div>
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            User type
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 font-sans text-sm">
              <input
                type="radio"
                checked={userType === "admin"}
                onChange={() => setUserType("admin")}
              />
              Admin user
            </label>
            <label className="flex items-center gap-2 font-sans text-sm">
              <input
                type="radio"
                checked={userType === "staff"}
                onChange={() => setUserType("staff")}
              />
              Staff member
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            Job role
          </label>
          <select
            value={jobRoleId}
            onChange={(e) => setJobRoleId(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
          >
            {jobRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.permissionCount} permissions)
              </option>
            ))}
          </select>
          {selectedRole ? (
            <p className="mt-1 font-sans text-xs text-text-light">
              {selectedRole.permissionCount} permissions
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            Job title
          </label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
            placeholder="e.g. Head Beader"
          />
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            Department
          </label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
            placeholder="e.g. Production"
          />
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            Full Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
            placeholder="email@example.com"
          />
        </div>
      </div>
      <div className="mt-8 flex justify-end gap-3">
        <Button type="button" variant="ghost-light" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" loading={submitting} onClick={() => void submit()}>
          Send Invitation
        </Button>
      </div>
    </Modal>
  );
}

function EditUserModal({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setRole(user.role);
    setIsActive(user.isActive);
  }, [user]);

  if (!user) return null;

  const submit = async () => {
    if (user.isProtected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(user.role !== "SUPER_ADMIN" ? { role } : {}),
          isActive,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to update user");
        return;
      }
      toast.success("User updated");
      onClose();
      onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit User" className="max-w-lg">
      {user.isProtected ? (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-sand bg-bg/40 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-mid" strokeWidth={1.5} />
          <div>
            <p className="font-sans text-sm font-medium text-text-dark">Protected account</p>
            <p className="mt-1 font-sans text-xs text-text-mid">
              This account cannot be edited or removed from the admin panel.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
              Full Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
            />
          </div>
          <div>
            <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
              Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full cursor-not-allowed rounded-[3px] border border-sand bg-bg/60 px-4 py-3 font-sans text-sm text-text-mid"
            />
          </div>
          {user.role !== "SUPER_ADMIN" ? (
            <div>
              <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full rounded-[3px] border border-sand bg-bg-card px-4 py-3 font-sans text-sm text-text-dark outline-none focus:border-nut"
              >
                {INVITE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {INVITE_ROLE_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block font-sans text-xs font-semibold uppercase tracking-[0.12em] text-text-mid">
                Role
              </label>
              <p className="font-sans text-sm text-text-dark">Super Admin</p>
            </div>
          )}
          <label className="flex items-center gap-3 font-sans text-sm text-text-dark">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-nut"
            />
            Account active
          </label>
        </div>
      )}
      <div className="mt-8 flex justify-end gap-3">
        <Button type="button" variant="ghost-light" onClick={onClose}>
          {user.isProtected ? "Close" : "Cancel"}
        </Button>
        {!user.isProtected ? (
          <Button type="button" loading={submitting} onClick={() => void submit()}>
            Save Changes
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

export function UserManagementClient() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    if (!res.ok) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { items: UserRow[] };
    setItems(data.items);
    setLoading(false);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 300);
    return () => clearTimeout(t);
  }, [refresh]);

  const deactivateUser = useCallback(async (user: UserRow) => {
    if (user.isProtected) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(typeof data.error === "string" ? data.error : "Failed to deactivate user");
      return;
    }
    toast.success(`${user.name ?? user.email} deactivated`);
    await refresh();
  }, [refresh]);

  const confirmDelete = async () => {
    if (!deleteUser || deleteUser.isProtected) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; softDeleted?: boolean };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to remove user");
        return;
      }
      toast.success(
        data.softDeleted
          ? `${deleteUser.name ?? deleteUser.email} deactivated (has activity history)`
          : `${deleteUser.name ?? deleteUser.email} removed`,
      );
      setDeleteUser(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    const targets = items.filter((u) => ids.includes(u.id) && !u.isProtected);
    if (targets.length === 0) {
      toast.error("No removable users selected");
      return;
    }
    const results = await Promise.all(
      targets.map((u) => fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })),
    );
    if (results.some((r) => !r.ok)) {
      toast.error("Some removals failed");
    } else {
      toast.success(`Processed ${targets.length} user(s)`);
    }
    await refresh();
  };

  const columns: BulkColumn<UserRow>[] = useMemo(
    () => [
      {
        key: "avatar",
        header: "",
        cell: (row) => <AvatarInitials name={row.name} email={row.email} />,
      },
      {
        key: "name",
        header: "Name",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-sans text-sm font-medium text-text-dark">
              {row.name ?? "—"}
            </span>
            {row.isProtected ? (
              <Lock className="h-3.5 w-3.5 text-text-light" strokeWidth={1.5} aria-label="Protected account" />
            ) : null}
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        cell: (row) => <span className="font-sans text-xs text-text-mid">{row.email}</span>,
      },
      {
        key: "role",
        header: "Role",
        cell: (row) => (
          <Badge variant={roleBadgeVariant(row.role)} size="sm">
            {displayRoleLabel(row.role)}
          </Badge>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={row.isActive ? "success" : "wine"} size="sm">
            {row.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      {
        key: "lastLogin",
        header: "Last Login",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">
            {row.lastLogin ? formatDate(row.lastLogin) : "Never"}
          </span>
        ),
      },
      {
        key: "createdAt",
        header: "Created",
        cell: (row) => (
          <span className="font-sans text-xs text-text-mid">{formatDate(row.createdAt)}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="rounded p-1.5 text-text-mid hover:bg-bg/80 hover:text-nut"
              aria-label={`Edit ${row.email}`}
              onClick={() => setEditUser(row)}
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={row.isProtected || !row.isActive}
              title={row.isProtected ? "This account is protected" : undefined}
              className={cn(
                "rounded p-1.5 text-text-mid hover:bg-bg/80 hover:text-nut",
                (row.isProtected || !row.isActive) && "cursor-not-allowed opacity-40",
              )}
              aria-label={`Deactivate ${row.email}`}
              onClick={() => void deactivateUser(row)}
            >
              <UserMinus className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={row.isProtected}
              title={row.isProtected ? "This account is protected" : undefined}
              className={cn(
                "rounded p-1.5 text-text-mid hover:bg-bg/80 hover:text-red-700",
                row.isProtected && "cursor-not-allowed opacity-40",
              )}
              aria-label={`Delete ${row.email}`}
              onClick={() => setDeleteUser(row)}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        ),
      },
    ],
    [deactivateUser],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1 className="mt-2 font-serif text-2xl font-medium text-choc">Users &amp; Roles</h1>
          <p className="mt-2 font-sans text-sm font-light text-text-mid">
            Invite staff, assign roles, and manage access to the operations suite.
          </p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          Invite User
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="min-w-[220px] flex-1 rounded-[3px] border border-sand bg-bg-card px-4 py-2.5 font-sans text-sm text-text-dark outline-none focus:border-nut"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-[3px] border border-sand bg-bg-card px-4 py-2.5 font-sans text-sm text-text-dark outline-none focus:border-nut"
        >
          <option value="all">All roles</option>
          {MANAGED_STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {displayRoleLabel(r)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[3px] border border-sand bg-bg-card px-4 py-2.5 font-sans text-sm text-text-dark outline-none focus:border-nut"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-text-mid">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-sans text-sm">Loading users…</span>
        </div>
      ) : (
        <BulkSelectTable
          columns={columns}
          data={items}
          onBulkDelete={handleBulkDelete}
          emptyMessage="No users match your filters."
        />
      )}

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={() => void refresh()}
      />

      <EditUserModal
        user={editUser}
        open={!!editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => void refresh()}
      />

      <Modal
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Remove user?"
        description={
          deleteUser
            ? `Are you sure you want to remove ${deleteUser.name ?? deleteUser.email}? This cannot be undone.`
            : undefined
        }
      >
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost-light" onClick={() => setDeleteUser(null)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
