"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientFileClient } from "@/components/admin/ClientFileClient";
import { ClientProfileClient } from "@/components/admin/ClientProfileClient";

/** Clicking a client's name opens her file; the CRM record (notes, messages, loyalty) sits beside it. */
export function ClientFileTabs({ clientId }: { clientId: string }) {
  const [tab, setTab] = useState<"file" | "crm">("file");
  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] ${
      active ? "border-ink text-ink" : "border-transparent text-text-light hover:text-ink"
    }`;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 border-b border-sand">
        <div className="flex gap-6">
          <button type="button" className={tabClass(tab === "file")} onClick={() => setTab("file")}>
            Client file
          </button>
          <button type="button" className={tabClass(tab === "crm")} onClick={() => setTab("crm")}>
            Record &amp; messages
          </button>
        </div>
        <Link
          href="/admin/clients"
          className="pb-2 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-text-light hover:text-nut"
        >
          ← Clients
        </Link>
      </div>
      {tab === "file" ? <ClientFileClient clientId={clientId} /> : <ClientProfileClient clientId={clientId} />}
    </div>
  );
}
