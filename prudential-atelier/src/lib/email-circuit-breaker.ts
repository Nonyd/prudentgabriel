const OPEN_AFTER = 3;
const COOLDOWN_MS = 5 * 60_000;

type Breaker = { failures: number; openUntil: number };

const breakers = new Map<string, Breaker>();

export function resetEmailCircuitBreakers(): void {
  breakers.clear();
}

export function recordEmailProviderSuccess(name: string): void {
  breakers.delete(name);
}

export function recordEmailProviderFailure(name: string, now = Date.now()): void {
  const cur = breakers.get(name) ?? { failures: 0, openUntil: 0 };
  cur.failures += 1;
  if (cur.failures >= OPEN_AFTER) {
    cur.openUntil = now + COOLDOWN_MS;
  }
  breakers.set(name, cur);
}

/** True when the provider should be skipped (open circuit, not in probe window). */
export function isEmailProviderCircuitOpen(name: string, now = Date.now()): boolean {
  const cur = breakers.get(name);
  if (!cur || cur.failures < OPEN_AFTER) return false;
  return now < cur.openUntil;
}

export function emailCircuitSnapshot(name: string): Breaker | undefined {
  const cur = breakers.get(name);
  return cur ? { ...cur } : undefined;
}
