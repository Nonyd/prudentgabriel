import { RestoreBagClient } from "@/components/checkout/RestoreBagClient";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = tokenRouteMetadata("Restore your bag");

export default async function CheckoutRestorePage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <RestoreBagClient token={params.token} />;
}
