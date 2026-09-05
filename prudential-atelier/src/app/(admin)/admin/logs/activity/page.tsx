import { Suspense } from "react";
import { ActivityLogClient } from "@/components/admin/ActivityLogClient";

export default function AdminActivityLogPage() {
  return (
    <Suspense fallback={<p className="font-sans text-sm text-text-mid">Loading…</p>}>
      <ActivityLogClient />
    </Suspense>
  );
}
