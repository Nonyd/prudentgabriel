import { Suspense } from "react";
import { PaymentSuccessClient } from "@/components/payment/PaymentSuccessClient";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <Suspense fallback={<p className="py-20 text-center font-body text-sm">Loading…</p>}>
        <PaymentSuccessClient />
      </Suspense>
    </div>
  );
}
