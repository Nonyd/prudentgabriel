/**
 * What a sign-in form tells the person, from next-auth's signIn() result.
 * Client-safe (no server imports).
 *
 * A rate-limit refusal is not a wrong password: saying "invalid credentials"
 * sends someone who just reset their password round in circles. The auth route
 * answers a limited attempt with ?error=RateLimited&code=<seconds>.
 */

export const RATE_LIMITED_ERROR = "RateLimited";

/** code= on a CredentialsSignin that failed on the server, not on the password. */
export const SIGNIN_SERVER_ERROR_CODE = "server_error";

/** Auth.js errors that land on the customer sign-in page (?error=). */
const PAGE_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email already has an account with a password. Sign in with your password instead.",
  AccessDenied: "That sign-in was refused. Please try again, or use your email and password.",
  OAuthSignin: "We could not start Google sign-in. Please try again.",
  OAuthCallbackError: "Google sign-in did not complete. Please try again.",
  Callback: "Sign-in did not complete. Please try again.",
  Configuration: "Sign-in is not available just now. Please try again shortly.",
  Verification: "That sign-in link has expired. Please try again.",
};

export type SignInResultLike = {
  error?: string | null;
  code?: string | null;
  status?: number;
} | undefined | null;

export function signInErrorMessage(result: SignInResultLike): string {
  if (result?.error === RATE_LIMITED_ERROR || result?.status === 429) {
    const secs = Number(result?.code);
    const minutes = Number.isFinite(secs) && secs > 0 ? Math.max(1, Math.ceil(secs / 60)) : 15;
    return `Too many sign-in attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"}, then try once more.`;
  }
  if (result?.code === SIGNIN_SERVER_ERROR_CODE) {
    return "We couldn't check your password just now. Please try again in a moment.";
  }
  if (result?.error && PAGE_ERRORS[result.error]) return PAGE_ERRORS[result.error];
  return "Invalid email or password. Please try again.";
}
