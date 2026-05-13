"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export function GenerateInvoiceButton({ bespokeId }: { bespokeId: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="mt-4 border border-[#37392d] px-4 py-2 font-body text-[11px] font-medium uppercase tracking-[0.1em] text-[#37392d]"
      onClick={async () => {
        const res = await fetch("/api/admin/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bespokeRequestId: bespokeId }),
        });
        if (!res.ok) {
          toast.error("Could not create invoice");
          return;
        }
        const j = (await res.json()) as { id: string };
        toast.success("Invoice created");
        router.push(`/admin/invoices/${j.id}/edit`);
      }}
    >
      Generate invoice
    </button>
  );
}
