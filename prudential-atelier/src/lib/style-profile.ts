import type { ClientProfile } from "@prisma/client";

/** Pure: safe in client components (account-helpers pulls in server-only code). */
export function styleProfileComplete(
  profile: Pick<ClientProfile, "preferredSilhouettes" | "preferredColors" | "occasions" | "budgetRange">,
): boolean {
  return (
    profile.preferredSilhouettes.length > 0 ||
    profile.preferredColors.length > 0 ||
    profile.occasions.length > 0 ||
    Boolean(profile.budgetRange)
  );
}
