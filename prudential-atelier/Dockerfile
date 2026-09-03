# syntax=docker/dockerfile:1
# Production image for Coolify / Docker Compose (GHCR).
# Build context: prudential-atelier/
#
# NEXT_PUBLIC_* are baked into the client bundle at build time.
# Runtime secrets (DATABASE_URL, AUTH_SECRET, payment private keys) stay in compose env files.

FROM node:20-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates gosu \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
ENV NODE_ENV=development
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm config set fetch-retries 5 \
  && pnpm install --frozen-lockfile

FROM base AS builder
ARG NODE_MEMORY_MB=4096
ARG DATABASE_URL="postgresql://build:build@127.0.0.1:5432/pa_build"
ARG DIRECT_URL="postgresql://build:build@127.0.0.1:5432/pa_build"
ARG NEXT_PUBLIC_APP_URL="https://prudentgabriel.com"
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=""
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=""
ARG NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=""
ARG NEXT_PUBLIC_STRIPE_PUBLIC_KEY=""

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_MB}"
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_URL=${DIRECT_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}
ENV NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=${NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY}
ENV NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=${NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY}
ENV NEXT_PUBLIC_STRIPE_PUBLIC_KEY=${NEXT_PUBLIC_STRIPE_PUBLIC_KEY}
# Pages that call Prisma during `next build` must not require a live database.
ENV SKIP_DB_BUILD=1

RUN pnpm prisma generate && pnpm build:next

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# pnpm nests prisma/tsx; Next standalone does not trace the CLI. Install globally for migrate/seed.
RUN npm install -g prisma@5.22.0 tsx@4.21.0 bcryptjs@3.0.3
ENV NODE_PATH=/usr/local/lib/node_modules
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# X6: run `tsx --tsconfig tsconfig.scripts.json scripts/migrate-cloudinary-media.ts` in the container
# so files land on MEDIA_ROOT, not a laptop disk.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-cloudinary-media.ts ./scripts/migrate-cloudinary-media.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/preload-test-env.ts ./scripts/preload-test-env.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib ./src/lib
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.scripts.json ./tsconfig.scripts.json
# Standalone output does not always trace sharp; next/image needs the native binary.
RUN npm install --omit=dev --os=linux --cpu=x64 sharp@0.33.5 \
  && chown -R nextjs:nodejs /app/node_modules/sharp
ENV NEXT_SHARP_PATH=/app/node_modules/sharp
COPY --chown=root:root entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER root
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["./entrypoint.sh"]
