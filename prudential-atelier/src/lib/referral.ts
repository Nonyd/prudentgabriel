export function buildReferralUrl(code: string, baseUrl?: string): string {
  const origin = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const clean = origin.replace(/\/$/, "");
  return `${clean}/ref/${code}`;
}
