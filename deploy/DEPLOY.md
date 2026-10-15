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
- `DATABASE_URL` and `DIRECT_URL` — host **`prudentgabriel-postgres`** (prod) or **`prudentgabriel-staging-postgres`** (staging), **not** `postgres`. The Coolify network also resolves `postgres` to Coolify’s own database (Prisma P1000).
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

## 4b. Live chat stream through Cloudflare (Slice BF) — one-time, Nony

Chat's typing indicator and live messages travel over a server-sent event stream:
`/api/chat/stream` (the visitor) and `/api/admin/chat/stream` (the inbox). A proxy
that buffers or compresses the stream holds every event back until a buffer fills.

What the repository already does (nothing to change on the server):

- The app sends `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-store, no-transform`
  and `X-Accel-Buffering: no`. `no-transform` keeps Next's own gzip and Cloudflare's compression off it.
- A comment line every 20 seconds keeps it inside Cloudflare's 100-second idle limit.
- Traefik's `pg-gzip` already excludes `text/event-stream` (see `traefik/pg-compose-stacks.yaml`). Traefik does not buffer responses.

What cannot be done from the repository: **Cloudflare is configured in its dashboard, not in code.**
Production sits behind Cloudflare; staging does not. Before chat goes live on production:

1. Cloudflare → `prudentgabriel.com` → **Caching → Cache Rules → Create rule**
   - Name: `Chat streams: bypass`
   - When: *URI Path* *starts with* `/api/chat/stream` **or** *URI Path* *starts with* `/api/admin/chat/stream`
   - Then: **Cache eligibility → Bypass cache**. Deploy.
2. Cloudflare → `prudentgabriel.com` → **Rules → Compression Rules → Create rule**
   - Name: `Chat streams: no compression`, same two paths, action **Disable compression**. Deploy.
3. Check it (needs a conversation cookie, so the inbox is easier): sign in to `/admin/chat` on
   production and open a conversation. Beside the Open/Closed chips it says **Live** when the stream
   works and **Refreshing every few seconds** when it fell back to polling. From a shell:

   ```bash
   curl -sN -H "Cookie: <your authjs.session-token cookie>" https://prudentgabriel.com/api/admin/chat/stream | head -5
   ```

   `event: ready` must arrive at once, not after a minute.

If the rules are not added, chat still works: the widget and the inbox detect a stream that never
opens and poll every few seconds instead (no typing indicator, messages up to ~5 s late).

**Capacity.** Each open chat panel and each open inbox holds one connection to the single app
container; it costs memory, not a database connection (events fan out in memory). Measured on the
production build: see `prudential-atelier/docs/VERIFICATION_2026-10-BF.md`. If the site ever runs more
than one app container, the in-memory fan-out (`src/lib/chat-bus.ts`) must move to Postgres
LISTEN/NOTIFY first.

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

The job list is `prudential-atelier/src/lib/cron/catalog.ts`. Render the host
file with `scripts/render-host-cron.ts` (see `prudential-atelier/docs/CRON.md`).

Install on the VPS (sudo):

```bash
cd /opt/prudentgabriel/deploy
sudo bash install-host-cron.sh
```

`cron-fire.sh` reads `CRON_SECRET` from `.env.production`. Do not put the secret
in the crontab. Do not enable `CRON_SCHEDULER=1` on production.

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

## 9b. Restore from backup (runbook and quarterly drill)

Written before the first drill. Every line marked **(drill)** is filled in by the
first timed restore; until then this section is a plan, not a proof.

### What exists

- `backup-media.sh` runs nightly at **02:15 UTC = 03:15 Lagos** and writes, per
  run: `pg-prod-*.dump`, `pg-staging-*.dump`, `media-*.tar.gz`,
  `media-staging-*.tar.gz` — each with `.age` on the end once
  `BACKUP_AGE_RECIPIENT` is set. Kept `BACKUP_KEEP` days (14, undecided — legal
  item 9). No off-site copy yet.
- `media-*.tar.gz` is the whole of `/opt/prudentgabriel/media`, **including
  `private/`** (bank-transfer receipts, consultation uploads). A database
  restore without it brings back the payment rows and loses the proof behind them.
- **Not in any backup:** `deploy/.env.production` and `.env.staging`. They hold
  `ENCRYPTION_KEY` — without the same key a restored database's `*Enc` columns
  (gateway keys, saved cards, link tokens) cannot be read — plus `AUTH_SECRET`,
  `CRON_SECRET` and the database password. They must be kept in the recovery
  kit below, not only on this server.

### The recovery kit (never on this server)

| Item | Where it lives | Who holds it |
|---|---|---|
| age private key (`AGE-SECRET-KEY-…`) | **(decide)** | Nony and **(name a second person)** |
| `.env.production` copy | **(decide)** — same place as the key | same |
| SSH key for `deploy@5.189.168.55` | Nony's laptop | **(second person)** |

A backup only one person can decrypt is a single point of failure. Two named
people, two places, checked at every drill.

### What is lost

The last backup is at 03:15 Lagos. A failure at **20:00 loses about 17 hours**
of work: every payment confirmed, note added, stage completed and order placed
since 03:15. A failure just before 03:15 loses almost **24 hours**. Payment
gateways (Paystack, Flutterwave, Stripe) keep their own records; webhooks that
arrived in the gap must be replayed or reconciled by hand from the gateway
dashboards.

### How long it takes

- Decrypt: **(drill)** minutes. Restore: **(drill)** minutes. Site serving again: **(drill)** minutes.

### Drill (quarterly — the `restore-drill-reminder` job emails the house)

Into a throwaway container with **no network**, so neither app can reach it.
Run on the server as `deploy`; the key file is brought in for the drill and
removed after, never stored there.

```bash
cd /var/backups/prudentgabriel            # or BACKUP_DIR
F=$(ls -t pg-prod-*.dump.age | head -1)   # last night's production dump
docker run -d --name pg-restore-drill --network none -e POSTGRES_PASSWORD=drill postgres:18-alpine
sleep 5
time age -d -i ~/drill-key.txt "$F" > /dev/shm/drill.dump             # decrypt, timed (RAM, not disk)
time docker exec -i pg-restore-drill pg_restore -U postgres -d postgres --no-owner < /dev/shm/drill.dump
rm -f /dev/shm/drill.dump ~/drill-key.txt
```

Check, side by side with production (read-only):

```sql
SELECT (SELECT count(*) FROM "User") users, (SELECT count(*) FROM "ClientProfile") clients,
       (SELECT count(*) FROM "BespokeOrder") commissions, (SELECT count(*) FROM "Payment") payments,
       (SELECT sum(amount) FROM "Payment" WHERE status::text IN ('CONFIRMED','PAID')) ledger_ngn,
       (SELECT count(*) FROM "ConsultationBooking") consultations, (SELECT count(*) FROM "Order") orders,
       (SELECT count(*) FROM "StoreItem") store_items, (SELECT count(*) FROM "StoreMovement") movements,
       (SELECT count(*) FROM pg_trigger WHERE tgname LIKE '%append_only%') append_only_triggers;
```

The ledger total must match to the naira; `append_only_triggers` must match
production. Then:

```bash
M=$(ls -t media-*.tar.gz.age | grep -v staging | head -1)
age -d -i ~/drill-key.txt "$M" | tar -tz | grep -c 'media/private/'   # receipts are in it
docker rm -f pg-restore-drill
```

Encrypted columns: start a local copy of the app against the drill database
with the kit's `ENCRYPTION_KEY` and open a saved gateway key in Settings — or
note that the drill did not check it.

Record the date, the three timings and anything improvised in **Drill log**.

### Real recovery: "the database is gone" → "the site is serving"

```bash
cd /opt/prudentgabriel/deploy
docker compose --env-file .env.production -f compose.production.yaml stop app        # 1. stop writes
# 2. turn on maintenance if the app is still reachable, so nobody pays into a gap
docker compose --env-file .env.production -f compose.production.yaml up -d postgres   # 3. an empty/healthy database
F=$(ls -t /var/backups/prudentgabriel/pg-prod-*.dump.age | head -1)
age -d -i ~/recovery-key.txt "$F" | docker exec -i prudentgabriel-postgres \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'   # 4. restore
M=$(ls -t /var/backups/prudentgabriel/media-2*.tar.gz.age | head -1)
age -d -i ~/recovery-key.txt "$M" | sudo tar -xz -C /opt/prudentgabriel                  # 5. media, receipts included
rm -f ~/recovery-key.txt
docker compose --env-file .env.production -f compose.production.yaml up -d app          # 6. entrypoint runs migrate deploy
curl -fsS https://prudentgabriel.com/api/maintenance-status                             # 7. serving
```

If the server itself is gone: provision, follow sections 2–5 with the kit's
`.env.production`, fetch the latest encrypted files from the off-site copy (once
it exists), then steps 3–7.

### Drill log

| Date | Dump used | Decrypt | Restore | Counts match | Ledger match | Triggers | Receipt opened | Improvised |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | not yet run |

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
