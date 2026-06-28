#!/bin/bash
# yingnode hotspot diagnostic script
# Run on the target device: sudo bash diagnose-hotspot.sh
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

echo "============================================"
echo " yingnode hotspot diagnostic"
echo "============================================"
echo ""

# ---- 1. Required tools ----
echo "--- Required tools ---"
for tool in iw ip ping hostapd dnsmasq nmcli systemctl pgrep; do
  if command -v $tool &>/dev/null; then
    pass "$tool"
  else
    fail "$tool — NOT FOUND"
  fi
done
echo ""

# ---- 2. WiFi interface ----
WIFI_IFACE="${WIFI_INTERFACE:-wlan0}"
echo "--- WiFi interface: $WIFI_IFACE ---"

if ip link show "$WIFI_IFACE" &>/dev/null; then
  pass "interface exists"
  STATE=$(ip link show "$WIFI_IFACE" | grep -oP 'state \K\w+')
  echo "  state: $STATE"
else
  fail "interface $WIFI_IFACE not found"
  exit 1
fi

# iw info
if IW_OUT=$(iw dev "$WIFI_IFACE" info 2>&1); then
  TYPE=$(echo "$IW_OUT" | grep -oP 'type \K\w+')
  echo "  iw type: $TYPE"
  pass "iw dev info"
else
  fail "iw dev info failed: $IW_OUT"
fi
echo ""

# ---- 3. WiFi association ----
echo "--- WiFi association ---"
if IW_LINK=$(iw dev "$WIFI_IFACE" link 2>&1); then
  if echo "$IW_LINK" | grep -q "Not connected"; then
    warn "Not associated with any AP"
  else
    SSID=$(echo "$IW_LINK" | grep -oP 'SSID: \K.*')
    echo "  Associated to: $SSID"
    pass "associated"
  fi
else
  fail "iw dev link failed: $IW_LINK"
fi
echo ""

# ---- 4. IP addresses ----
echo "--- IP addresses on $WIFI_IFACE ---"
ip -4 addr show dev "$WIFI_IFACE" | grep inet || warn "no IPv4"
echo ""

# ---- 5. Ping test ----
echo "--- Internet connectivity ---"
PING_OK=false
for target in 223.5.5.5 114.114.114.114 8.8.8.8; do
  if ping -c 1 -W 2 "$target" &>/dev/null; then
    pass "ping $target"
    PING_OK=true
    break
  fi
done
if ! $PING_OK; then
  fail "ping — no internet"
fi
echo ""

# ---- 6. hostapd test ----
echo "--- hostapd dry-run ---"
HOSTAPD_CONF="/tmp/hostapd-yingnode-test.conf"
cat > "$HOSTAPD_CONF" <<EOF
interface=$WIFI_IFACE
driver=nl80211
ssid=yingnode-test
hw_mode=g
channel=6
EOF
if hostapd -dd "$HOSTAPD_CONF" > /tmp/hostapd-test.log 2>&1 &
  HOSTAPD_PID=$!
  sleep 3
  if kill -0 $HOSTAPD_PID 2>/dev/null; then
    pass "hostapd started (pid $HOSTAPD_PID)"
    # Check if AP mode is active
    if iw dev "$WIFI_IFACE" info 2>/dev/null | grep -q "type AP"; then
      pass "interface is in AP mode"
    else
      warn "hostapd running but interface not in AP mode"
    fi
    kill $HOSTAPD_PID 2>/dev/null
    sleep 1
    # Restore managed mode
    iw dev "$WIFI_IFACE" set type managed 2>/dev/null || true
  else
    fail "hostapd failed to start — check /tmp/hostapd-test.log"
    echo "  Last 5 lines of log:"
    tail -5 /tmp/hostapd-test.log
  fi
else
  fail "hostapd command not found"
fi
rm -f "$HOSTAPD_CONF" /tmp/hostapd-test.log
echo ""

# ---- 7. dnsmasq test ----
echo "--- dnsmasq dry-run ---"
if dnsmasq --test 2>&1 | head -1; then
  pass "dnsmasq config OK"
else
  fail "dnsmasq test failed"
fi
echo ""

# ---- 8. NetworkManager status ----
echo "--- NetworkManager ---"
if systemctl is-active --quiet NetworkManager 2>/dev/null; then
  NM_MANAGED=$(nmcli device status 2>/dev/null | grep "$WIFI_IFACE" || true)
  echo "  $NM_MANAGED"
  pass "NetworkManager active"
else
  warn "NetworkManager not running"
fi
echo ""

# ---- 9. DB status ----
echo "--- Database status ---"
if [ -f prisma/dev.db ]; then
  STATUS=$(sqlite3 prisma/dev.db "SELECT status, hotspotActive, currentSSID FROM NetworkStatus WHERE id=1;" 2>/dev/null || echo "no record")
  echo "  $STATUS"
  pass "DB readable"
else
  warn "prisma/dev.db not found (run from project root)"
fi
echo ""

# ---- 10. Monitor check ----
echo "--- Next.js monitor ---"
if pgrep -f "next" &>/dev/null; then
  pass "Next.js process running"
else
  warn "Next.js not running — monitor won't fire"
fi
echo ""

echo "============================================"
echo " Diagnostic complete"
echo "============================================"
