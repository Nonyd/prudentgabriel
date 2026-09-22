import { getSetting } from "@/lib/settings";
import { DEFAULT_FABRIC_PROMISE_HOURS, FABRIC_PROMISE_HOURS_KEY } from "@/lib/fabric-unavailable";

/**
 * AR5: hours the house promises to offer an alternative or a refund when a
 * fabric is unavailable. Server only (reads settings); fabric-unavailable.ts
 * stays importable from client components.
 */
export async function getFabricPromiseHours(): Promise<number> {
  const n = Number(await getSetting(FABRIC_PROMISE_HOURS_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_FABRIC_PROMISE_HOURS;
}
