import { createRequire } from "node:module";
import path from "node:path";

// Optional: present on the laptop, absent in the GHCR runtime image (Slice X runs there).
try {
  const require = createRequire(import.meta.url);
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => void };
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });
} catch {
  /* runtime image already has DATABASE_URL / ENCRYPTION_KEY */
}

process.env.ENCRYPTION_KEY ??= "test-slice-a-encryption-key-do-not-use";
process.env.SETTINGS_ENCRYPTION_KEY ??= process.env.ENCRYPTION_KEY;
