#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# YingNode 一键部署脚本
# 用法: curl -fsSL <RAW_URL>/deploy/install.sh | sudo bash
# ============================================================

REPO="https://github.com/wang-zhongyu/yingnode-web.git"
INSTALL_DIR="/opt/yingnode"
NODE_VERSION="22"
SERVICE_NAME="yingnode"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[YingNode]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ---- 检测系统 ----
detect_os() {
    if [ ! -f /etc/os-release ]; then
        warn "无法检测系统版本，继续但不保证兼容性"
        return
    fi
    . /etc/os-release
    log "检测到: $NAME"
}

# ---- 安装 Node.js ----
install_node() {
    if command -v node &>/dev/null && [ "$(node -v | cut -d. -f1 | tr -d 'v')" -ge "$NODE_VERSION" ]; then
        log "Node.js $(node -v) 已安装"
        return
    fi

    log "安装 Node.js ${NODE_VERSION}..."
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
    apt-get install -y nodejs
    log "Node.js $(node -v) 安装完成"
}

# ---- 安装网络依赖 ----
install_network_deps() {
    log "安装网络管理依赖..."
    apt-get update
    apt-get install -y --no-install-recommends \
        hostapd dnsmasq wireless-tools wpasupplicant \
        iproute2 git
}

# ---- 创建系统用户 ----
create_user() {
    if id "yingnode" &>/dev/null; then
        log "用户 yingnode 已存在"
    else
        useradd -r -s /usr/sbin/nologin -M yingnode
        log "创建用户 yingnode"
    fi
}

# ---- 部署应用 ----
deploy_app() {
    if [ -d "$INSTALL_DIR/.git" ]; then
        log "更新已有仓库..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        log "克隆仓库..."
        rm -rf "$INSTALL_DIR"
        git clone "$REPO" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    log "安装依赖..."
    npm ci

    log "生成 Prisma Client..."
    npx prisma generate

    log "同步数据库结构..."
    mkdir -p /data
    npx prisma db push
}

# ---- 构建应用 ----
build_app() {
    cd "$INSTALL_DIR"
    log "构建应用..."
    npm run build

    # Next.js standalone 不自动加载 .env，复制到 standalone 目录
    cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.next/standalone/.env"
    log "构建完成"
}

# ---- 配置系统 ----
configure_system() {
    log "写入系统配置..."
    cp "$INSTALL_DIR/config/sudoers.d/yingnode" /etc/sudoers.d/yingnode
    chmod 440 /etc/sudoers.d/yingnode

    # 确保 hostapd/dnsmasq 配置存在
    cp -n "$INSTALL_DIR/config/hostapd.conf" /etc/hostapd/hostapd.conf 2>/dev/null || true
    cp -n "$INSTALL_DIR/config/dnsmasq.conf" /etc/dnsmasq.conf 2>/dev/null || true
}

# ---- 配置环境变量 ----
configure_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        log ".env 已存在，跳过"
        return
    fi

    log "创建 .env 配置..."
    cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
TERMINAL_TOKEN="$(openssl rand -base64 16)"
EOF
    log ".env 已创建"
}

# ---- 安装后配置 ----
post_install() {
    log "验证部署..."
    cd "$INSTALL_DIR"
    if [ ! -f ".next/standalone/server.js" ]; then
        err "构建产物缺失: .next/standalone/server.js"
    fi
    if [ ! -f ".next/standalone/.env" ]; then
        warn ".env 未复制到 standalone 目录"
    fi
    log "部署验证通过"
}

# ---- 安装 systemd 服务 ----
install_service() {
    log "安装 systemd 服务文件..."
    cp "$INSTALL_DIR/deploy/yingnode.service" /etc/systemd/system/yingnode.service
    systemctl daemon-reload
    systemctl enable yingnode

    # Install ttyd terminal (GitHub release fallback for Kali)
    if ! command -v ttyd &>/dev/null; then
        log "安装 ttyd..."
        if ! apt install -y ttyd 2>/dev/null; then
            warn "apt 未找到 ttyd，从 GitHub 下载..."
            ARCH=$(uname -m)
            case "$ARCH" in
                x86_64)  TTYD_ARCH="x86_64" ;;
                aarch64) TTYD_ARCH="aarch64" ;;
                armv7l)  TTYD_ARCH="armv7" ;;
                *)       err "不支持的架构: $ARCH" ;;
            esac
            curl -fsSL "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}" -o /usr/local/bin/ttyd
            chmod +x /usr/local/bin/ttyd
            log "ttyd 安装完成"
        fi
    fi
    # Substitute TERMINAL_TOKEN in service file (use | delimiter to avoid base64 / conflict)
    sed "s|\${TERMINAL_TOKEN}|${TERMINAL_TOKEN}|g" \
        "$INSTALL_DIR/deploy/yingnode-terminal.service" \
        > /etc/systemd/system/yingnode-terminal.service
    systemctl enable yingnode-terminal
}

# ---- 启动服务 ----
start_services() {
    log "启动服务..."
    systemctl restart yingnode
    systemctl restart yingnode-terminal
    log "服务已启动"
}

# ---- 显示部署信息 ----
show_info() {
    echo ""
    log "============================================"
    log "  YingNode 部署完成!"
    log "============================================"
    log "  Web 面板:  http://${LOCAL_IP}:3000"
    log "  热点 SSID: yingnode"
    log "  热点 IP:   172.16.42.1"
    log "  服务状态:  systemctl status yingnode"
    log "  查看日志:  journalctl -u yingnode -f"
    log "============================================"
}

# ---- 主流程 ----
main() {
    if [ "$(id -u)" -ne 0 ]; then
        err "请用 root 运行: curl ... | sudo bash"
    fi

    log "YingNode 一键部署开始..."
    detect_os
    install_node
    install_network_deps
    create_user
    configure_env
    deploy_app
    configure_system
    install_service
    build_app
    post_install
    start_services
    show_info
}

main "$@"
