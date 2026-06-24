# yingnode-web

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-slim AS base

# Install system dependencies for network operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    hostapd dnsmasq wireless-tools wpasupplicant \
    iproute2 procps \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm ci --omit=dev && \
    npx prisma generate --no-engine

FROM base AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate --no-engine

COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

# Copy system configs
COPY config/sudoers.d/yingnode /etc/sudoers.d/yingnode
COPY config/hostapd.conf /etc/hostapd/hostapd.conf
COPY config/dnsmasq.conf /etc/dnsmasq.conf

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
