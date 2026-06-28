# yingnode-web
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS base

# Install system dependencies for network operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    hostapd dnsmasq wireless-tools wpasupplicant \
    iproute2 procps \
    && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm ci \
    && npx prisma generate \
    && npx prisma db push --skip-generate

COPY . .
RUN BETTER_AUTH_URL=http://localhost:3000 npm run build

FROM base AS runner
WORKDIR /app

# Next.js standalone output (includes minimal node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma CLI for runtime db push
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# System configs — hostapd/dnsmasq configs are generated dynamically by the
# application at runtime, so we only ship the static dnsmasq template.
COPY config/dnsmasq.conf /etc/dnsmasq.conf

# Entrypoint: sync DB schema then start server
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
