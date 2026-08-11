import { prisma } from "@/lib/prisma";

export { cmsGet, cmsBool, cmsJson, ANNOUNCEMENT_SPEED_MS } from "@/lib/cms-helpers";

export async function getCMSContent(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  if (process.env.SKIP_DB_BUILD === "1") return {};

  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  } catch {
    return {};
  }
}
