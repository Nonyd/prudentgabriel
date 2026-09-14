import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = tokenRouteMetadata("Your bag");

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
