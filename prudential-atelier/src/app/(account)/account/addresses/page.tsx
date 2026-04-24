import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function AddressesPage() {
  const session = await auth();
  const addresses = await prisma.address.findMany({
    where: { userId: session!.user!.id! },
    orderBy: [{ isDefault: "desc" }, { id: "desc" }],
  });

  return (
    <div>
      <h1 className="font-display text-3xl text-wine">Addresses</h1>
      <p className="mt-2 text-sm text-charcoal-mid">Saved shipping addresses for checkout.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="rounded-sm border border-border bg-cream p-5">
            {a.isDefault && (
              <span className="mb-2 inline-block rounded-sm bg-wine px-2 py-0.5 font-label text-[10px] text-ivory">
                Default
              </span>
            )}
            <p className="font-medium text-charcoal">
              {a.firstName} {a.lastName}
            </p>
            <p className="text-sm text-charcoal-mid">{a.phone}</p>
            <p className="mt-2 text-sm text-charcoal">
              {a.street}
              {a.addressLine2 ? `, ${a.addressLine2}` : ""}
              <br />
              {a.city}, {a.state} · {a.country}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-charcoal-mid">
        To add or edit addresses, use{" "}
        <Link href="/checkout" className="text-wine underline">
          checkout
        </Link>{" "}
        and tick &quot;Save this address&quot;, or contact support.
      </p>
    </div>
  );
}
