/**
 * next/cache for command-line bundles (pnpm bundle:import). Outside a Next server
 * there is no data cache: a cached function is just the function, and
 * revalidation has nothing to invalidate (the running app's caches expire on their own).
 */
export function unstable_cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
export function revalidateTag(): void {}
export function revalidatePath(): void {}
