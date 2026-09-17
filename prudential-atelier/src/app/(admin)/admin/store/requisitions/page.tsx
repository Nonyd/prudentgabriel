import { Suspense } from "react";
import { StoreRequisitionsClient } from "@/components/admin/store/StoreRequisitionsClient";

export default function AdminStoreRequisitionsPage() {
  return (
    <Suspense fallback={<p className="font-sans text-sm text-text-mid">Loading…</p>}>
      <StoreRequisitionsClient />
    </Suspense>
  );
}
