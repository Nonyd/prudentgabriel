/**
 * Optional media fields may be left out of a save. On Zod 4 they were required,
 * so Account settings failed with "image: Invalid input" on every profile save.
 *
 *   pnpm test:media-url-schemas
 */
import { z } from "zod";
import { emptyableStoredPublicMediaUrlSchema, optionalStoredPrivateMediaUrlSchema } from "../src/lib/media/stored-url";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const form = z.object({
  name: z.string().optional(),
  image: emptyableStoredPublicMediaUrlSchema,
  file: optionalStoredPrivateMediaUrlSchema,
});

assert(form.safeParse({ name: "Nony" }).success, "a save without an image or file passes");
assert(form.safeParse({ image: "" }).success, "an empty image clears it");
assert(!form.safeParse({ image: "javascript:alert(1)" }).success, "a bad image URL is still refused");
assert(form.safeParse({ file: null }).success, "a null file passes");
assert(!form.safeParse({ file: "nope" }).success, "a bad file URL is still refused");
console.log("test-media-url-schemas: ok");
