"use client";

import { useState } from "react";
import { UserManagementClient } from "@/components/admin/settings/UserManagementClient";
import { RolePermissionsPanel } from "@/components/admin/settings/RolePermissionsPanel";
import { cn } from "@/lib/utils";

type Tab = "people" | "roles";

export function AccessManagementClient() {
  const [tab, setTab] = useState<Tab>("people");

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Super Admin</p>
        <h1 className="admin-heading-pill glass-1 glass-pill mt-2 font-serif text-2xl font-medium text-choc">Users &amp; Roles</h1>
        <p className="mt-2 font-sans text-sm font-light text-text-mid">
          Role permissions are the default. User overrides are the exception.
        </p>
      </div>

      <div className="flex gap-1 border-b border-sand">
        {(
          [
            { id: "people" as const, label: "People" },
            { id: "roles" as const, label: "Role permissions" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-choc",
              tab === t.id ? "border-b-2 border-choc text-choc" : "text-text-mid hover:text-text-dark",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "people" ? <UserManagementClient embedded /> : <RolePermissionsPanel />}
    </div>
  );
}
