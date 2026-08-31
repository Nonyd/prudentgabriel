/**
 * A JWT can outlive the User row (staging restore, re-seeded cuids).
 * Rebind to the current row by email, or drop the session.
 */
export function bindSessionUser(opts: {
  foundById: { id: string; isActive: boolean } | null;
  foundByEmail: { id: string; isActive: boolean } | null;
}): { id: string; rebound: boolean } | null {
  if (opts.foundById) {
    if (opts.foundById.isActive === false) return null;
    return { id: opts.foundById.id, rebound: false };
  }
  if (opts.foundByEmail) {
    if (opts.foundByEmail.isActive === false) return null;
    return { id: opts.foundByEmail.id, rebound: true };
  }
  return null;
}

export class SessionUserMissingError extends Error {
  readonly userId: string;
  constructor(userId: string) {
    super("SESSION_USER_MISSING");
    this.name = "SessionUserMissingError";
    this.userId = userId;
  }
}
