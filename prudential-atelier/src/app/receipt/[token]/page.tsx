import { ReceiptConfirmClient } from "@/components/public/ReceiptConfirmClient";

export default async function ReceiptConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-ivory">
      <ReceiptConfirmClient token={token} />
    </main>
  );
}
