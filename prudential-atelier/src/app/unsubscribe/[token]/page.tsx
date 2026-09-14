import { prisma } from "@/lib/prisma";
import { UnsubscribeClient } from "@/components/public/UnsubscribeClient";
import { tokenRouteMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return tokenRouteMetadata("Unsubscribe");
}

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pref = await prisma.emailPreference.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true, unsubscribedAt: true },
  });

  if (!pref) {
    return (
      <UnsubscribeClient
        token={token}
        status="invalid"
        email={null}
      />
    );
  }

  return (
    <UnsubscribeClient
      token={token}
      status={pref.unsubscribedAt ? "done" : "confirm"}
      email={pref.email}
    />
  );
}
