#!/usr/bin/env bash
set -e

# Sync database schema on every start (idempotent)
npx prisma db push --skip-generate

# Start the Next.js server
exec node .next/standalone/server.js
