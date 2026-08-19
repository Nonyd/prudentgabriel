# In-memory rate limiting

`src/lib/rate-limit.ts` is a process-local `Map`. Limits reset on deploy, restart,
and do not share across multiple app containers.

That is a known ceiling. It still blocks naive brute force on a single instance.
A shared store (Redis) is out of scope for this slice.

Applied to login (credentials callback), register, forgot-password, public track
lookup, guest order lookup, and pre-auth career/consultation uploads.
