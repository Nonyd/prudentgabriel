import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export default async function AdminConsultantsPage() {
  const consultants = await prisma.consultant.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      _count: { select: { offerings: true, bookings: true } },
    },
  });

  return (
    <div className="space-y-2 p-6 text-ink">
      <h1 className="font-display text-2xl text-ink">Consultants</h1>
      <p className="text-sm text-text-mid">Manage profiles, offerings, and weekly availability.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {consultants.map((c) => (
          <div key={c.id} className="card-surface p-4">
            <div className="flex gap-3">
              {c.image ? (
                <Image src={c.image} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-sand/40" />
              )}
              <div>
                <p className="font-medium text-ink">{c.name}</p>
                <p className="text-xs text-nut">{c.title}</p>
                <p className="mt-1 text-xs text-text-mid">
                  Offerings: {c._count.offerings} · Bookings: {c._count.bookings}
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  {c.isActive ? (
                    <span className="rounded-sm bg-success-soft px-2 py-0.5 text-success">Active</span>
                  ) : (
                    <span className="rounded-sm bg-sand/40 px-2 py-0.5 text-text-mid">Inactive</span>
                  )}
                  {c.isFlagship && (
                    <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-warning">Flagship</span>
                  )}
                </div>
                <Link href={`/admin/consultants/${c.id}/edit`} className="mt-3 inline-block text-sm text-nut underline">
                  Edit
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
