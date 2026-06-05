import { getSession } from "next-auth/react";
import type { Session } from "next-auth";
import type { SignInResponse } from "next-auth/react";

export function isSignInFailure(res: SignInResponse | undefined): boolean {
  return !res?.ok || Boolean(res?.error);
}

type WaitOptions = {
  maxAttempts?: number;
  delayMs?: number;
  /** Defaults to waiting until `session.user.id` is set. */
  until?: (session: Session | null) => boolean;
};

export async function waitForClientSession(options?: WaitOptions): Promise<Session | null> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const delayMs = options?.delayMs ?? 100;
  const until =
    options?.until ?? ((session) => Boolean(session?.user?.id));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const session = await getSession();
    if (until(session)) return session;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

/** Full navigation so middleware and RSC see the new session cookie. */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
