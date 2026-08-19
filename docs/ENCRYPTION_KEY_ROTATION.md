# Encryption key rotation (settings / PSP secrets)

Site settings of type `PASSWORD` (Paystack, Flutterwave, Stripe, Monnify secret keys, Stripe webhook secret, SMTP password, and similar) are encrypted with AES-256-GCM using `ENCRYPTION_KEY`, falling back to `SETTINGS_ENCRYPTION_KEY`. There is no in-code fallback string. The process refuses to boot if neither variable is set.

## When to re-enter secrets

Re-paste every encrypted setting through **Admin → Settings → Developer / Payments** after:

1. First setting a real `ENCRYPTION_KEY` (values stored under the old hardcoded fallback cannot be decrypted with the new key).
2. Any later rotation of `ENCRYPTION_KEY` / `SETTINGS_ENCRYPTION_KEY`.
3. Restoring a database dump into an environment that uses a different key.

Do not copy ciphertext between environments that do not share the same key.

## Staging (VPS)

Keys live only on the server, in `/opt/prudentgabriel/deploy/.env.staging`. They are not in git.

1. Confirm both variables are set (length only; do not print the value):

   ```bash
   cd /opt/prudentgabriel/deploy
   grep -E '^(ENCRYPTION_KEY|SETTINGS_ENCRYPTION_KEY)=' .env.staging | sed -E 's/=.+/=SET/'
   ```

2. If you rotate the key, update `.env.staging`, then recreate the app container so it picks up the new env:

   ```bash
   docker compose --env-file .env.staging -f compose.staging.yaml up -d --force-recreate app
   ```

3. Sign in as an admin on https://staging.prudentgabriel.com and open payment settings. For each gateway that should stay live, paste the **current** secret from the PSP dashboard (not the old ciphertext). Save. Repeat for Stripe webhook signing secret if used.

4. Make a test initialize (or a ₦100 Paystack test charge) to confirm decrypt + API auth work.

## Production

Same procedure against `/opt/prudentgabriel/deploy/.env.production` and https://prudentgabriel.com. Do this as an operational step; do not wait for an application deploy.

Password rotation for `admin@prudentgabriel.com` is also out of band (Auth.js user row). Seeding no longer resets that password.

## Generating a key

Use a long random secret (32+ bytes). Example:

```bash
openssl rand -base64 32
```

Set the same value on `ENCRYPTION_KEY` and `SETTINGS_ENCRYPTION_KEY` unless you intentionally split them. Only `ENCRYPTION_KEY` is required if `SETTINGS_ENCRYPTION_KEY` is unset.
