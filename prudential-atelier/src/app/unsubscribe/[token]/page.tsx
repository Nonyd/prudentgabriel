import { prisma } from "@/lib/prisma";
import { UnsubscribeClient } from "@/components/public/UnsubscribeClient";

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

export async function generateMetadata() {
  return { title: "Unsubscribe | Prudent Gabriel" };
}
