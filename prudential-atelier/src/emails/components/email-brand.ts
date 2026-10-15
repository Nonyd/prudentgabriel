import { AsyncLocalStorage } from "node:async_hooks";
import type { EmailBrand } from "@/lib/email-branding";
import type { EmailSignOff } from "@/lib/email-sign-off";

export { brandSignOff, type EmailSignOff } from "@/lib/email-sign-off";

/**
 * Which house mark and closing one rendered email uses. Not React context:
 * email code is reachable from server components, where createContext is
 * refused. Scoped per render, so two emails rendering at once never mix.
 */
export type EmailRenderScope = {
  brand: EmailBrand;
  /** `null` means none: staff and admin mail, and messages that carry their own. */
  signOff: EmailSignOff | null;
};

const scope = new AsyncLocalStorage<EmailRenderScope>();

export function renderInEmailScope<T>(value: EmailRenderScope, render: () => Promise<T>): Promise<T> {
  return scope.run(value, render);
}

export function currentEmailScope(): EmailRenderScope {
  return scope.getStore() ?? { brand: "main", signOff: null };
}
