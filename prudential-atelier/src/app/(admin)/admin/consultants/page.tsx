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
    <div className="p-6 text-[#eaeaea]">
      <h1 className="font-display text-2xl text-gold">Consultants</h1>
      <p className="mt-2 text-sm text-[#aaa]">Manage profiles, offerings, and weekly availability.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {consultants.map((c) => (
          <div key={c.id} className="rounded-sm border border-[rgba(201,168,76,0.2)] bg-[#252525] p-4">
            <div className="flex gap-3">
              {c.image ? (
                <Image src={c.image} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[#444]" />
              )}
              <div>
                <p className="font-medium text-ivory">{c.name}</p>
                <p className="text-xs text-gold">{c.title}</p>
                <p className="mt-1 text-xs text-[#888]">
                  Offerings: {c._count.offerings} · Bookings: {c._count.bookings}
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  {c.isActive ? (
                    <span className="rounded-sm bg-emerald-900/40 px-2 py-0.5 text-emerald-200">Active</span>
                  ) : (
                    <span className="rounded-sm bg-[#444] px-2 py-0.5">Inactive</span>
                  )}
                  {c.isFlagship && (
                    <span className="rounded-sm bg-wine/40 px-2 py-0.5 text-gold">Flagship</span>
                  )}
                </div>
                <Link href={`/admin/consultants/${c.id}/edit`} className="mt-3 inline-block text-sm text-gold underline">
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
