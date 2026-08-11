# Production deploy — Docker Compose + Traefik + GHCR

Same pattern as Fashion Academy on the shared VPS (`5.189.168.55`). Each stack has its own **Postgres** + **app**. Volumes and container names do **not** overlap with PFA.

| Environment | Compose file | Env file | Bind | GHCR tag | Public URL |
|-------------|--------------|----------|------|----------|------------|
| Production | `compose.production.yaml` | `.env.production` | `127.0.0.1:3010` | `production` | https://prudentgabriel.com |
| Staging | `compose.staging.yaml` | `.env.staging` | `127.0.0.1:3011` | `staging` | https://staging.prudentgabriel.com |

Run compose commands from **`deploy/`** on the server (`/opt/prudentgabriel/deploy`). Images are built in **GitHub Actions** → **GHCR** (no on-server `next build` unless you use the emergency override).

Coolify Traefik terminates HTTPS (Let's Encrypt). Apps join the external **`coolify`** network.

---

## 1. One-time: GitHub → GHCR + SSH deploy secrets

Repo: **`Nonyd/prudentgabriel`**. Manage secrets with the **`gh` CLI**:

```bash
gh auth refresh -h github.com -s read:packages,write:packages
gh secret set GHCR_PAT --body "$(gh auth token)" --repo Nonyd/prudentgabriel

gh secret set SSH_PRIVATE_KEY --body "$(cat ~/.ssh/id_ed25519_nony_pfacademy)" --repo Nonyd/prudentgabriel
gh secret set SSH_HOST --body "5.189.168.55" --repo Nonyd/prudentgabriel
gh secret set SSH_USER --body "deploy" --repo Nonyd/prudentgabriel
```

| Secret | Purpose |
|--------|---------|
| `GHCR_PAT` | `docker login ghcr.io` on the server (`read:packages`) |
| `SSH_PRIVATE_KEY` | Private key matching the server’s `authorized_keys` |
| `SSH_HOST` | Server IP (`5.189.168.55`) |
| `SSH_USER` | Linux user that can run `docker compose` (`deploy` on this VPS) |

**Optional build-time secrets** (baked `NEXT_PUBLIC_*` in the image):

| Secret | Default if unset |
|--------|------------------|
| `PA_BUILD_NEXT_PUBLIC_APP_URL` | `https://prudentgabriel.com` |
| `PA_BUILD_STAGING_NEXT_PUBLIC_APP_URL` | `https://staging.prudentgabriel.com` |
| `PA_BUILD_NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | empty |
| `PA_BUILD_NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | empty |
| `PA_BUILD_NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY` | empty |
| `PA_BUILD_NEXT_PUBLIC_STRIPE_PUBLIC_KEY` | empty |
| `PA_BUILD_STAGING_NEXT_PUBLIC_*` | fall back to the production `PA_BUILD_*` values |

Runtime secrets live only in `/opt/prudentgabriel/deploy/.env.production` and `.env.staging`. Changing `NEXT_PUBLIC_*` after the first image requires a **rebuild**.

After push to **`main`** / **`staging`**, workflows build → push to **`ghcr.io/nonyd/prudentgabriel`** (`:production` / `:staging`) → SSH redeploy.

```bash
gh secret list --repo Nonyd/prudentgabriel
```

Create the **`staging`** branch once (from `main`) so the staging workflow has a target:

```bash
git checkout main
git pull
git checkout -b staging
git push -u origin staging
```

---

## 2. One-time: server directories + GHCR login

SSH to the same host as PFA:

```bash
ssh pfacademy
# Host pfacademy → deploy@5.189.168.55 (see ~/.ssh/config)
```

Docker is already installed for Fashion Academy. Log in to GHCR if packages are private:

```bash
echo "<PAT_WITH_read:packages>" | docker login ghcr.io -u nonyd --password-stdin
```

```bash
sudo mkdir -p /opt/prudentgabriel/deploy
sudo chown "$USER:$USER" /opt/prudentgabriel/deploy
```

---

## 3. One-time: copy `deploy/` onto the server

**Option A — sparse checkout (only `deploy/`):**

```bash
cd /opt/prudentgabriel
git clone --depth 1 --filter=blob:none --sparse https://github.com/Nonyd/prudentgabriel.git repo
cd repo
git sparse-checkout set deploy
cp -a deploy/. /opt/prudentgabriel/deploy/
```

**Option B — full clone** (needed for on-server `docker build`):

```bash
git clone --depth 1 -b main https://github.com/Nonyd/prudentgabriel.git /opt/prudentgabriel/repo
cp -a /opt/prudentgabriel/repo/deploy/. /opt/prudentgabriel/deploy/
```

Create env files:

```bash
cd /opt/prudentgabriel/deploy
cp .env.production.example .env.production
cp .env.staging.example .env.staging
chmod 600 .env.production .env.staging
nano .env.production
nano .env.staging
```

Minimum checks (both files):

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — **different** from PFA
- `DATABASE_URL` and `DIRECT_URL` — host **`postgres`**, same credentials as above
- `AUTH_SECRET` / `NEXTAUTH_SECRET` — long random (`openssl rand -base64 32`)
- `NEXTAUTH_URL` + `NEXT_PUBLIC_APP_URL` — match the public HTTPS origin
- `CRON_SECRET` — used by host crontab
- `PRISMA_MIGRATE_DEPLOY_FATAL=1`
- `PA_MAIN_IMAGE=ghcr.io/nonyd/prudentgabriel`
- `PA_IMAGE_TAG=production` or `staging`

On **first** start you can set `RUN_DB_SEED_ON_START=safe` (bootstrap settings + admin). Unset it after the first healthy boot.

---

## 4. Traefik / HTTPS (Coolify proxy)

Install the file provider **next to** PFA’s (do not overwrite `pfa-compose-stacks.yaml`):

```bash
sudo cp /opt/prudentgabriel/deploy/traefik/pg-compose-stacks.yaml \
  /data/coolify/proxy/dynamic/pg-compose-stacks.yaml
```

Traefik reloads automatically (`providers.file.watch=true`).

| Domain | Backend container |
|--------|-------------------|
| `prudentgabriel.com` | `http://prudentgabriel-main:3000` |
| `www.prudentgabriel.com` | 301 → apex |
| `staging.prudentgabriel.com` | `http://prudentgabriel-staging:3000` |

DNS A/AAAA for those names must point at this server before Let's Encrypt can issue certs.

---

## 5. First start

Production:

```bash
cd /opt/prudentgabriel/deploy
docker compose --env-file .env.production -f compose.production.yaml pull
docker compose --env-file .env.production -f compose.production.yaml up -d
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs -f --tail=100 app
```

Staging — same commands with `.env.staging` and `compose.staging.yaml`.

Confirm logs show:

```text
[entrypoint] Running database migrations...
[entrypoint] Starting Next.js
```

Then open https://staging.prudentgabriel.com and https://prudentgabriel.com.

---

## 6. Cron (replaces Vercel crons)

Vercel `vercel.json` crons do **not** run on this host. Call the same routes with `CRON_SECRET`:

```cron
0 0 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/abandoned-cart >/dev/null 2>&1
0 0 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/expired-coupons >/dev/null 2>&1
0 0 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/rotate-qr >/dev/null 2>&1
0 9 * * 1-6 curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/late-alert >/dev/null 2>&1
0 9 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/event-reminders >/dev/null 2>&1
0 23 * * *  curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/daily-report >/dev/null 2>&1
0 7 * * 1   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/weekly-report >/dev/null 2>&1
0 2 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/update-performance >/dev/null 2>&1
0 9 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/review-requests >/dev/null 2>&1
0 9 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/balance-reminders >/dev/null 2>&1
0 10 * * *  curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/stage-approval-reminders >/dev/null 2>&1
0 2 * * *   curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/update-bestsellers >/dev/null 2>&1
0 11 * * *  curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/unsent-quote-alerts >/dev/null 2>&1
0 10 * * *  curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://prudentgabriel.com/api/cron/receipt-reminders >/dev/null 2>&1
```

Use the same `CRON_SECRET` as in `.env.production`. Repeat with the staging host if you want jobs there too.

---

## 7. Subsequent updates

After **`main`** / **`staging`** is pushed and the matching workflow finishes, Actions SSH-redeploys automatically.

Manual:

```bash
cd /opt/prudentgabriel/deploy
docker compose --env-file .env.production -f compose.production.yaml pull
docker compose --env-file .env.production -f compose.production.yaml up -d --force-recreate app
docker compose --env-file .env.production -f compose.production.yaml logs --tail=80 app
```

If compose/Traefik files changed, refresh the copy from git first, then recreate.

---

## 8. Emergency: build on the server

Only if GHCR is unavailable and the host has enough RAM. Needs a **full repo clone**:

```bash
cd /opt/prudentgabriel/repo
git pull
cd /opt/prudentgabriel/deploy
docker compose --env-file .env.production \
  -f compose.production.yaml -f compose.production.build.yaml \
  up -d --build
```

---

## 9. Webhooks and OAuth

Register after DNS + TLS work:

- Paystack: `https://prudentgabriel.com/api/payment/paystack/webhook`
- Flutterwave: `https://prudentgabriel.com/api/payment/flutterwave/webhook`
- Stripe: `https://prudentgabriel.com/api/payment/stripe/webhook`
- Monnify: `https://prudentgabriel.com/api/payment/monnify/webhook`
- Google OAuth redirect: `https://prudentgabriel.com/api/auth/callback/google`

Use the `staging.` host for sandbox keys.

---

## 10. Troubleshooting

| Symptom | Check |
|--------|--------|
| `prisma migrate deploy` fails | `DATABASE_URL` / `DIRECT_URL`, Postgres healthy, `_prisma_migrations` |
| 401 on GHCR pull | `docker login ghcr.io` or `GHCR_PAT` |
| Site not reachable / no TLS | DNS A record, Traefik file present, app on `coolify` network |
| Wrong public URLs in browser | Rebuild image ( `NEXT_PUBLIC_*` are bake-time ) |
| Auth redirect loop | `NEXTAUTH_URL` must match the URL users open |
| Cron 401 | `Authorization: Bearer` matches `CRON_SECRET` |

Do **not** run `pnpm seed:demo` or `pnpm seed:fixtures` against production.

---

## 11. File reference

| File | Purpose |
|------|---------|
| `deploy/compose.production.yaml` | Prod Postgres + app |
| `deploy/compose.staging.yaml` | Staging Postgres + app |
| `deploy/compose.production.build.yaml` | Optional on-server `docker build` |
| `deploy/compose.staging.build.yaml` | Optional staging local build |
| `deploy/.env.production.example` | Prod env template |
| `deploy/.env.staging.example` | Staging env template |
| `deploy/traefik/pg-compose-stacks.yaml` | Coolify Traefik routes |
| `prudential-atelier/Dockerfile` | App image |
| `.github/workflows/docker-publish-ghcr-*.yml` | CI build → GHCR → SSH |

Image: **`ghcr.io/nonyd/prudentgabriel`**.
