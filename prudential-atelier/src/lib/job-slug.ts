import { prisma } from "@/lib/prisma";
import { slugifyText } from "@/lib/utils";

export async function uniqueJobSlug(title: string, excludeId?: string): Promise<string> {
  const baseSlug = slugifyText(title) || "job";
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
    const existing = await prisma.jobPosting.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    suffix += 1;
  }
}
