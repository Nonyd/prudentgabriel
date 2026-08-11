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

RUN pnpm prisma generate && pnpm build:next

# Prisma CLI + tsx for migrate/seed at container start (not in standalone trace).
FROM deps AS prisma-cli-deps
RUN mkdir -p /prisma-node_modules && cd /app/node_modules && \
    for pkg in prisma @prisma tsx esbuild get-tsconfig resolve-pkg-maps bcryptjs; do \
      if [ -e "$pkg" ]; then cp -a "$pkg" /prisma-node_modules/; fi; \
    done

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/false nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=prisma-cli-deps --chown=nextjs:nodejs /prisma-node_modules/ ./node_modules/
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=root:root entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER root
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["./entrypoint.sh"]
