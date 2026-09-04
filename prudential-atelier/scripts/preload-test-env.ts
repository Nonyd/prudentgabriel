import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

process.env.ENCRYPTION_KEY ??= "test-slice-a-encryption-key-do-not-use";
process.env.SETTINGS_ENCRYPTION_KEY ??= process.env.ENCRYPTION_KEY;
