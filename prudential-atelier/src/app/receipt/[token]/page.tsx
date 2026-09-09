import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReceiptConfirmClient } from "@/components/public/ReceiptConfirmClient";
import { loadPublicReceipt } from "@/lib/public-receipt-payload";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Confirm receipt | Prudential Atelier",
    robots: { index: false, follow: false },
  };
}

export default async function ReceiptConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await loadPublicReceipt(token);
  if (!view) notFound();

  return (
    <main className="min-h-screen bg-ivory">
      <ReceiptConfirmClient token={token} view={view} />
    </main>
  );
}
