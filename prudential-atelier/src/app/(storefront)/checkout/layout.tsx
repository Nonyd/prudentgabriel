import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = tokenRouteMetadata("Checkout");

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
