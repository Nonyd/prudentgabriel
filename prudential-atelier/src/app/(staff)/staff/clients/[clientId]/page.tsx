import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientFileClient } from "@/components/admin/ClientFileClient";

type Props = { params: Promise<{ clientId: string }> };

/**
 * Slice BC1 — the client file from the workroom. The API decides what shows:
 * only the commissions this person is on, and only what the staff portal
 * already shows for them (measurements for the tailor or pattern cutter).
 */
export default async function StaffClientFilePage({ params }: Props) {
  const { clientId } = await params;
  return (
    <div className="space-y-6">
      <Link href="/staff" className="inline-flex items-center gap-1 font-sans text-xs text-text-mid">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <ClientFileClient clientId={clientId} portal="staff" />
    </div>
  );
}
