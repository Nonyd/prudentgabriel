import Link from "next/link";
import { auth } from "@/auth";
import { bespokeFacts } from "@/lib/atelier/bespoke-access";
import { ClientOnboardingWizard } from "@/components/admin/ClientOnboardingWizard";

export const dynamic = "force-dynamic";

/** Admin → Clients → New client. Same gate as POST /api/admin/clients/onboard. */
export default async function NewClientPage() {
  const session = await auth();
  const allowed = session?.user?.id ? await bespokeFacts(session, { key: "clients" }).then(({ facts }) => facts.admin && facts.house) : false;
  if (!allowed) {
    return (
      <div className="card-surface mx-auto max-w-2xl p-6 font-sans text-sm text-text-mid">
        Adding clients by hand is for admins. Ask an admin to add her, or{" "}
        <Link href="/admin/clients" className="underline">
          go back to Clients
        </Link>
        .
      </div>
    );
  }
  return <ClientOnboardingWizard />;
}
