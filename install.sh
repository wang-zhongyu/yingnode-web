#!/bin/bash
# One-click install script for yingnode-web on Kali Linux Raspberry Pi
# Run on the target device: curl -sSL <url>/install.sh | sudo bash
#
# Or copy and run locally: sudo bash install.sh

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/yingnode"
DATA_DIR="/data"
SERVICE_NAME="yingnode"

# ── Defaults (override via env or edit after install in $INSTALL_DIR/.env) ──
HOTSPOT_SSID="${HOTSPOT_SSID:-yingnode}"
HOTSPOT_IP="${HOTSPOT_IP:-172.16.42.1}"
WIFI_INTERFACE="${WIFI_INTERFACE:-wlan0}"
PORT="${PORT:-3000}"

# Generate random secrets if not provided
if [ -z "${HOTSPOT_PASSWORD:-}" ]; then
  # 8-char alphanumeric, lowercase, no confusing chars (0/o, 1/l)
  HOTSPOT_PASSWORD=$(head -c16 /dev/urandom | tr -dc 'a-z2-9' | head -c8)
  # Ensure minimum length — if entropy starved, fall back
  [ ${#HOTSPOT_PASSWORD} -ge 6 ] || HOTSPOT_PASSWORD=$(openssl rand -hex 4 2>/dev/null)
fi
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  BETTER_AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c32 /dev/urandom | base64)
fi
if [ -z "${TERMINAL_TOKEN:-}" ]; then
  TERMINAL_TOKEN=$(openssl rand -base64 24 2>/dev/null || head -c24 /dev/urandom | base64)
fi

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   yingnode-web — One-Click Install          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ──
echo -e "${CYAN}[1/7] Checking prerequisites...${NC}"

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}This script must be run as root.${NC}"
  exit 1
fi

# Install hostapd/dnsmasq if missing
for pkg in hostapd dnsmasq; do
  if ! command -v $pkg &>/dev/null; then
    echo "  Installing $pkg..."
    apt-get update -qq && apt-get install -y -qq $pkg
  fi
done

# Stop any running instance
systemctl stop $SERVICE_NAME 2>/dev/null || true
killall -9 hostapd dnsmasq node 2>/dev/null || true
iw dev "$WIFI_INTERFACE" set type managed 2>/dev/null || true

# ── Directories ──
echo -e "${CYAN}[2/7] Creating directories...${NC}"
mkdir -p "$INSTALL_DIR" "$DATA_DIR"

# ── Environment file ──
echo -e "${CYAN}[3/7] Writing configuration...${NC}"
cat > "$INSTALL_DIR/.env" << EOF
# yingnode-web configuration
DATABASE_URL="file:$DATA_DIR/yingnode.db"
WIFI_INTERFACE="$WIFI_INTERFACE"
HOTSPOT_SSID="$HOTSPOT_SSID"
HOTSPOT_IP="$HOTSPOT_IP"
HOTSPOT_PASSWORD="$HOTSPOT_PASSWORD"
BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET"
BETTER_AUTH_URL="http://localhost:$PORT"
TERMINAL_TOKEN="$TERMINAL_TOKEN"
NODE_ENV=production
PORT=$PORT
EOF
echo "  → $INSTALL_DIR/.env"

# ── Deploy project ──
echo -e "${CYAN}[4/7] Deploying project files...${NC}"
# Find the project source — either alongside this script or from a known location
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR=""

# Try common source locations
if [ -f "$SCRIPT_DIR/package.json" ]; then
  SOURCE_DIR="$SCRIPT_DIR"
elif [ -f "/home/kali/yingnode-web/package.json" ]; then
  SOURCE_DIR="/home/kali/yingnode-web"
elif [ -f "$HOME/yingnode-web/package.json" ]; then
  SOURCE_DIR="$HOME/yingnode-web"
fi

if [ -z "$SOURCE_DIR" ]; then
  echo -e "${RED}Cannot find project source. Place this script in the project root or copy the project to /home/kali/yingnode-web/ first.${NC}"
  exit 1
fi

echo "  Source: $SOURCE_DIR"
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  "$SOURCE_DIR/" "$INSTALL_DIR/"

# ── Install dependencies & build ──
echo -e "${CYAN}[5/7] Installing dependencies & building...${NC}"
cd "$INSTALL_DIR"
npm install --silent
npx prisma generate
npx prisma db push  2>/dev/null || npx prisma db push 
npm run build

# ── Systemd service ──
echo -e "${CYAN}[6/7] Installing systemd service...${NC}"
cat > "/etc/systemd/system/$SERVICE_NAME.service" << UNIT
[Unit]
Description=YingNode - Portable Linux Device Manager
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which npx) next start
Restart=always
RestartSec=5
StartLimitBurst=3
StartLimitIntervalSec=60
Environment=NODE_ENV=production
Environment=PORT=$PORT
EnvironmentFile=-$INSTALL_DIR/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=yingnode

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

# ── Start ──
echo -e "${CYAN}[7/7] Starting service...${NC}"
systemctl start "$SERVICE_NAME"

sleep 10

# ── Verify ──
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$PORT/api/health" | grep -q '200'; then
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   Install complete!                         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  Hotspot SSID:     $HOTSPOT_SSID"
  echo "  Hotspot Password: $HOTSPOT_PASSWORD"
  echo "  Hotspot IP:       http://$HOTSPOT_IP:$PORT"
  echo ""
  echo "  Manage service:"
  echo "    sudo systemctl status $SERVICE_NAME"
  echo "    sudo journalctl -u $SERVICE_NAME -f"
  echo ""
else
  echo ""
  echo -e "${RED}Server may still be starting. Check logs:${NC}"
  echo "  sudo journalctl -u $SERVICE_NAME -n 20"
fi
