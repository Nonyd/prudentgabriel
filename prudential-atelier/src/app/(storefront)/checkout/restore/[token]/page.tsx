import { RestoreBagClient } from "@/components/checkout/RestoreBagClient";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = tokenRouteMetadata("Restore your bag");

export default function CheckoutRestorePage({ params }: { params: { token: string } }) {
  return <RestoreBagClient token={params.token} />;
}
