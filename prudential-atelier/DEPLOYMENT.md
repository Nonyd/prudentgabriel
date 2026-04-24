# Prudential Atelier — Deployment Guide

## Vercel deployment

### Step 1 — Database (Neon.tech)

1. Create an account at [https://neon.tech](https://neon.tech).
2. Create a new project named `prudential-atelier`.
3. Copy **DATABASE_URL** (pooled) and **DIRECT_URL** (direct / unpooled) from the Neon dashboard.

### Step 2 — Vercel project

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Framework: **Next.js** (auto-detected).
4. Build command: `npx prisma generate && next build` (or use the `build` script from `package.json`).

### Step 3 — Environment variables

Add the following in the Vercel project settings:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon pooled URL |
| `DIRECT_URL` | Neon direct URL |
| `NEXTAUTH_SECRET` | e.g. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Production site origin, e.g. `https://prudentgabriel.com` (must match the URL users open) |
| `NEXT_PUBLIC_APP_URL` | Same value as `NEXTAUTH_URL` in production (canonical public site URL) |
| `GOOGLE_CLIENT_ID` | Optional (OAuth) |
| `GOOGLE_CLIENT_SECRET` | Optional |
| `CLOUDINARY_CLOUD_NAME` | Optional — upload API falls back without keys |
| `CLOUDINARY_API_KEY` | Optional |
| `CLOUDINARY_API_SECRET` | Optional |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Optional |
| `PAYSTACK_SECRET_KEY` | From Paystack dashboard |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | |
| `FLUTTERWAVE_SECRET_KEY` | |
| `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` | |
| `STRIPE_SECRET_KEY` | |
| `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | |
| `STRIPE_WEBHOOK_SECRET` | |
| `MONNIFY_API_KEY` | |
| `MONNIFY_SECRET_KEY` | |
| `MONNIFY_CONTRACT_CODE` | |
| `MONNIFY_BASE_URL` | Default `https://api.monnify.com` |
| `RESEND_API_KEY` | Optional — emails log to console if absent |
| `OPEN_EXCHANGE_RATES_APP_ID` | Optional |
| `ADMIN_EMAIL` | e.g. `admin@prudentgabriel.com` |
| `ADMIN_PASSWORD` | Used only for documentation; real admin is seeded in DB |
| `CRON_SECRET` | Random string for cron routes |

### Step 4 — After deploy

```bash
npx prisma migrate deploy
npx prisma db seed
```

(Or `npx prisma db push` for an initial schema push where migrations are not used.)

### Step 5 — Webhook URLs

Register in each payment dashboard:

- Paystack: `https://[domain]/api/payment/paystack/webhook`
- Flutterwave: `https://[domain]/api/payment/flutterwave/webhook`
- Stripe: `https://[domain]/api/payment/stripe/webhook`
- Monnify: `https://[domain]/api/payment/monnify/webhook`

### Step 6 — Google OAuth (optional)

In Google Cloud Console → OAuth 2.0 client, set authorized redirect URI:

`https://[domain]/api/auth/callback/google`

## Email previews (local)

```bash
npm run email:dev
```

Opens React Email preview (default port **3001**) for templates under `src/emails/`.

## Test accounts (after seed)

| Role | Email | Password |
|------|--------|----------|
| Admin | admin@prudentgabriel.com | Admin@PA2024! |
| Customer | amara@example.com | Customer@2024 |
| Customer | chidinma@example.com | Customer@2024 |
| Customer | folake@example.com | Customer@2024 |

## Test coupons

`WELCOME10`, `FREESHIP`, `BRIDAL20`, `FLASH5000`, `VIP15`, `EXPIRED10`
