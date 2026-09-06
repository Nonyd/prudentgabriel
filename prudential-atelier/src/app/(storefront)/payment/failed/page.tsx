import { Suspense } from "react";
import { PaymentFailedClient } from "@/components/payment/PaymentFailedClient";

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<p className="py-20 text-center font-body text-sm">Loading…</p>}>
        <PaymentFailedClient />
      </Suspense>
    </div>
  );
}
