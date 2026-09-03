import { getSetting, setSetting } from "@/lib/settings";

/** Shown in Developer Settings when the database row is empty but the process env is set. */
export const ENV_SOURCE_LABEL = "Set in server environment";

export type CredentialSource = "database" | "environment" | "unset";
export type CredentialHome = "database" | "host_env" | "circular";

export type CredentialCatalogEntry = {
  id: string;
  settingKey?: string;
  envKeys: readonly string[];
  /** Where this value is allowed to live. */
  home: CredentialHome;
  /** Where the running code actually reads it today (after Slice U). */
  runtime: "database" | "environment";
  note: string;
};

/**
 * Every credential-shaped value the app reads.
 *
 * Circular host values cannot move: the process needs them before it can
 * decrypt settings rows or validate an admin session.
 */
export const CREDENTIAL_CATALOG: readonly CredentialCatalogEntry[] = [
  {
    id: "database_url",
    envKeys: ["DATABASE_URL", "DIRECT_URL"],
    home: "circular",
    runtime: "environment",
    note: "Required to open the database that would store it.",
  },
  {
    id: "encryption_key",
    envKeys: ["ENCRYPTION_KEY", "SETTINGS_ENCRYPTION_KEY"],
    home: "circular",
    runtime: "environment",
    note: "Encrypts settings rows; cannot encrypt itself.",
  },
  {
    id: "auth_secret",
    envKeys: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
    home: "circular",
    runtime: "environment",
    note: "Validates the session that is allowed to read settings.",
  },
  {
    id: "app_url",
    envKeys: ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"],
    home: "host_env",
    runtime: "environment",
    note: "Needed before any database read; NEXT_PUBLIC_* is baked at build time.",
  },
  {
    id: "cron_secret",
    envKeys: ["CRON_SECRET"],
    home: "host_env",
    runtime: "environment",
    note: "cron-fire.sh reads the host .env before the Node process starts.",
  },
  {
    id: "cloudinary",
    envKeys: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    home: "host_env",
    runtime: "environment",
    note: "Wired at module load in cloudinary.ts and every upload/sign route. Hostname allow-list is in next.config; the secret is runtime — moving it is possible but would re-plumb every media path. Left on the host.",
  },
  {
    id: "google_oauth",
    envKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    home: "host_env",
    runtime: "environment",
    note: "Auth.js provider config is constructed at process start.",
  },
  {
    id: "paystack_secret_key",
    settingKey: "paystack_secret_key",
    envKeys: ["PAYSTACK_SECRET_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "paystack_public_key",
    settingKey: "paystack_public_key",
    envKeys: ["NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "flutterwave_secret_key",
    settingKey: "flutterwave_secret_key",
    envKeys: ["FLUTTERWAVE_SECRET_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "flutterwave_public_key",
    settingKey: "flutterwave_public_key",
    envKeys: ["NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "flutterwave_secret_hash",
    settingKey: "flutterwave_secret_hash",
    envKeys: ["FLUTTERWAVE_SECRET_HASH"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "stripe_secret_key",
    settingKey: "stripe_secret_key",
    envKeys: ["STRIPE_SECRET_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Direct process.env reads in two routes removed.",
  },
  {
    id: "stripe_public_key",
    settingKey: "stripe_public_key",
    envKeys: ["NEXT_PUBLIC_STRIPE_PUBLIC_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "stripe_webhook_secret",
    settingKey: "stripe_webhook_secret",
    envKeys: ["STRIPE_WEBHOOK_SECRET"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "monnify_api_key",
    settingKey: "monnify_api_key",
    envKeys: ["MONNIFY_API_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "monnify_secret_key",
    settingKey: "monnify_secret_key",
    envKeys: ["MONNIFY_SECRET_KEY"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "monnify_contract_code",
    settingKey: "monnify_contract_code",
    envKeys: ["MONNIFY_CONTRACT_CODE"],
    home: "database",
    runtime: "database",
    note: "Was database-then-env. Env fallback removed.",
  },
  {
    id: "resend_api_key",
    settingKey: "resend_api_key",
    envKeys: ["RESEND_API_KEY"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database (silent send with an empty dashboard field). Env fallback removed.",
  },
  {
    id: "brevo_api_key",
    settingKey: "brevo_api_key",
    envKeys: ["BREVO_API_KEY", "SIB_API_KEY"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "smtp_password",
    settingKey: "smtp_password",
    envKeys: ["SMTP_PASSWORD"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "smtp_username",
    settingKey: "smtp_username",
    envKeys: ["SMTP_USER"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "smtp_host",
    settingKey: "smtp_host",
    envKeys: ["SMTP_HOST"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "smtp_port",
    settingKey: "smtp_port",
    envKeys: ["SMTP_PORT"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "sms_api_key",
    settingKey: "sms_api_key",
    envKeys: ["SMS_API_KEY"],
    home: "database",
    runtime: "database",
    note: "Stored on Developer Settings. No runtime sender wired yet.",
  },
  {
    id: "slack_webhook_url",
    settingKey: "slack_webhook_url",
    envKeys: ["SLACK_WEBHOOK_URL"],
    home: "database",
    runtime: "database",
    note: "Stored on Developer Settings. No runtime sender wired yet.",
  },
  {
    id: "gig_api_key",
    settingKey: "gig_api_key",
    envKeys: ["GIG_API_KEY"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database (isConfigured even ignored the DB). Env fallback removed.",
  },
  {
    id: "gig_wallet_id",
    settingKey: "gig_wallet_id",
    envKeys: ["GIG_WALLET_ID"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "dhl_site_id",
    settingKey: "dhl_site_id",
    envKeys: ["DHL_SITE_ID"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "dhl_password",
    settingKey: "dhl_password",
    envKeys: ["DHL_PASSWORD"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "dhl_account_number",
    settingKey: "dhl_account_number",
    envKeys: ["DHL_ACCOUNT_NUMBER"],
    home: "database",
    runtime: "database",
    note: "Was env-then-database. Env fallback removed.",
  },
  {
    id: "open_exchange_rates_app_id",
    settingKey: "open_exchange_rates_app_id",
    envKeys: ["OPEN_EXCHANGE_RATES_APP_ID"],
    home: "database",
    runtime: "database",
    note: "Moved off the host-env status block. Live FX source is a dashboard secret.",
  },
] as const;

export const MOVABLE_CREDENTIALS = CREDENTIAL_CATALOG.filter(
  (e): e is CredentialCatalogEntry & { settingKey: string } =>
    e.home === "database" && typeof e.settingKey === "string",
);

export function firstEnvValue(envKeys: readonly string[], env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of envKeys) {
    const v = env[key]?.trim();
    if (v) return v;
  }
  return null;
}

export function describeCredentialSource(
  databaseValue: string | null | undefined,
  environmentValue: string | null | undefined,
): CredentialSource {
  if (databaseValue?.trim()) return "database";
  if (environmentValue?.trim()) return "environment";
  return "unset";
}

export function credentialDisplayValue(
  source: CredentialSource,
  databaseValue: string | null | undefined,
  redacted: string,
): string {
  if (source === "database" && databaseValue?.trim()) return redacted;
  if (source === "environment") return ENV_SOURCE_LABEL;
  return "";
}

export async function getDashboardSecret(settingKey: string): Promise<string | null> {
  const fromDb = await getSetting(settingKey);
  const trimmed = fromDb?.trim();
  return trimmed ? trimmed : null;
}

export async function describeStoredCredential(
  entry: CredentialCatalogEntry & { settingKey: string },
): Promise<{
  key: string;
  source: CredentialSource;
  inDatabase: boolean;
  inEnvironment: boolean;
}> {
  const db = await getDashboardSecret(entry.settingKey);
  const env = firstEnvValue(entry.envKeys);
  const source = describeCredentialSource(db, env);
  return {
    key: entry.settingKey,
    source,
    inDatabase: source === "database",
    inEnvironment: Boolean(env),
  };
}

/** Copy env → empty encrypted rows. Does not overwrite a dashboard value. */
export async function adoptEnvCredentialsIntoDatabase(updatedBy = "system:env-adopt"): Promise<{
  adopted: string[];
}> {
  const adopted: string[] = [];
  for (const entry of MOVABLE_CREDENTIALS) {
    const existing = await getDashboardSecret(entry.settingKey);
    if (existing) continue;
    const env = firstEnvValue(entry.envKeys);
    if (!env) continue;
    await setSetting(entry.settingKey, env, updatedBy);
    adopted.push(entry.settingKey);
  }
  return { adopted };
}

export function hostEnvStatus(): {
  databaseUrl: boolean;
  authSecret: boolean;
  appUrl: boolean;
  encryption: boolean;
  cloudinary: boolean;
  cronSecret: boolean;
  googleOauth: boolean;
} {
  return {
    databaseUrl: Boolean(firstEnvValue(["DATABASE_URL", "DIRECT_URL"])),
    authSecret: Boolean(firstEnvValue(["AUTH_SECRET", "NEXTAUTH_SECRET"])),
    appUrl: Boolean(firstEnvValue(["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"])),
    encryption: Boolean(firstEnvValue(["ENCRYPTION_KEY", "SETTINGS_ENCRYPTION_KEY"])),
    cloudinary: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim(),
    ),
    cronSecret: Boolean(process.env.CRON_SECRET?.trim()),
    googleOauth: Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
  };
}
