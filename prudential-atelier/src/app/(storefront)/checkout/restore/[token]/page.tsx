import { RestoreBagClient } from "@/components/checkout/RestoreBagClient";

export default function CheckoutRestorePage({ params }: { params: { token: string } }) {
  return <RestoreBagClient token={params.token} />;
}
