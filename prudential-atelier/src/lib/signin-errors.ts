/**
 * What a sign-in form tells the person, from next-auth's signIn() result.
 * Client-safe (no server imports).
 *
 * A rate-limit refusal is not a wrong password: saying "invalid credentials"
 * sends someone who just reset their password round in circles. The auth route
 * answers a limited attempt with ?error=RateLimited&code=<seconds>.
 */

export const RATE_LIMITED_ERROR = "RateLimited";

export type SignInResultLike = {
  error?: string | null;
  code?: string | null;
  status?: number;
} | undefined | null;

export function signInErrorMessage(result: SignInResultLike): string {
  if (result?.error === RATE_LIMITED_ERROR || result?.status === 429) {
    const secs = Number(result?.code);
    const minutes = Number.isFinite(secs) && secs > 0 ? Math.max(1, Math.ceil(secs / 60)) : 15;
    return `Too many sign-in attempts from this device. Please wait ${minutes} minute${minutes === 1 ? "" : "s"}, then try once more.`;
  }
  return "Invalid email or password. Please try again.";
}
