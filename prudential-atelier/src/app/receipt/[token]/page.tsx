import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptConfirmClient } from "@/components/public/ReceiptConfirmClient";
import { CapabilityExpiredPage } from "@/components/public/CapabilityExpiredPage";
import { loadPublicReceipt } from "@/lib/public-receipt-payload";
import { tokenRouteMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Confirm receipt");
}

export default async function ReceiptConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await loadPublicReceipt(token);
  if (!result.ok) {
    if (result.reason === "expired") return <CapabilityExpiredPage />;
    notFound();
  }

  return (
    <main className="min-h-screen bg-ivory">
      <ReceiptConfirmClient token={token} view={result.payload} />
    </main>
  );
}
