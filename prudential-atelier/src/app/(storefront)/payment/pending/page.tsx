import { Suspense } from "react";
import { PaymentPendingClient } from "@/components/payment/PaymentPendingClient";

export default function PaymentPendingPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <Suspense fallback={<p className="py-20 text-center font-body text-sm">Loading…</p>}>
        <PaymentPendingClient />
      </Suspense>
    </div>
  );
}
