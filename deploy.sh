#!/bin/bash
# Deploy script for yingnode-web to Kali Linux Raspberry Pi
# Usage: ./deploy.sh [host] [user]
# Default: kali@192.168.31.40

set -euo pipefail

HOST="${1:-192.168.31.40}"
USER="${2:-kali}"
REMOTE_DIR="/home/$USER/yingnode-web"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "=== Syncing files to $USER@$HOST ==="
rsync -avz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  -e "ssh $SSH_OPTS" \
  ./ "$USER@$HOST:$REMOTE_DIR/"

echo "=== Building and restarting ==="
ssh $SSH_OPTS "$USER@$HOST" "bash -s" << 'ENDSSH'
set -euo pipefail
cd ~/yingnode-web

echo "[1/5] Installing dependencies..."
npm install --silent

echo "[2/5] Generating Prisma client..."
npx prisma generate

echo "[3/5] Building Next.js..."
npm run build

echo "[4/5] Stopping old server..."
# Kill any process on port 3000
sudo fuser -k 3000/tcp 2>/dev/null || true
# Kill any lingering node/npm processes
sudo killall -9 node 2>/dev/null || true
sudo killall -9 next-server 2>/dev/null || true

# Wait for port to be fully released
for i in $(seq 1 10); do
  if ! ss -tlnp | grep -q ':3000'; then
    echo "      Port 3000 freed"
    break
  fi
  echo "      Waiting for port 3000... ($i/10)"
  sleep 1
done

echo "[5/5] Starting server..."
# Use systemd if available, otherwise fall back to nohup
if systemctl is-enabled yingnode-web 2>/dev/null; then
  sudo systemctl restart yingnode-web
  echo "      Restarted via systemd"
else
  nohup npx next start > /tmp/yingnode.log 2>&1 &
  sleep 2
  echo "      Started via nohup (PID $!)"
fi

# Verify
sleep 3
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/api/health | grep -q '200'; then
  echo ""
  echo "=== Deploy successful! ==="
  echo "Server is running on port 3000"
else
  echo ""
  echo "=== Server may still be starting, check logs: ==="
  tail -20 /tmp/yingnode.log 2>/dev/null || echo "(no log file)"
fi
ENDSSH
