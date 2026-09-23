import { notFound } from "next/navigation";
import { tokenPageRateLimited } from "@/lib/page-rate-limit";
import { UnsubscribeClient } from "@/components/public/UnsubscribeClient";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { findEmailPreferenceByUnsubscribeToken } from "@/lib/capability-token-lookup";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Unsubscribe");
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (await tokenPageRateLimited("unsubscribe-token-page")) notFound();
  const { token } = await params;
  const pref = await findEmailPreferenceByUnsubscribeToken(decodeURIComponent(token));
  // A real 404, like every other capability link (not-found.tsx carries the copy).
  if (!pref) notFound();

  return (
    <UnsubscribeClient
      token={token}
      status={pref.unsubscribedAt ? "done" : "confirm"}
      email={pref.email}
    />
  );
}
