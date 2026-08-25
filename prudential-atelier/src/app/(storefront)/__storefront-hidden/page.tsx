import { notFound } from "next/navigation";

/** Rewrite target when the atelier storefront flag is off. URL stays the original path. */
export default function StorefrontHiddenPage() {
  notFound();
}
