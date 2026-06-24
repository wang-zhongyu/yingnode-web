#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# YingNode 一键部署脚本
#
# GitHub:
#   curl -fsSL https://raw.githubusercontent.com/wang-zhongyu/yingnode-web/main/deploy/install.sh | sudo bash
#
# 国内镜像 (Gitee):
#   curl -fsSL https://gitee.com/LukeWang95/yingnode-web/raw/main/deploy/install.sh | sudo bash
#
# npm 国内加速:
#   NPM_MIRROR=https://registry.npmmirror.com curl -fsSL <URL> | sudo bash
# ============================================================

REPO="https://github.com/wang-zhongyu/yingnode-web.git"
REPO_MIRROR="https://gitee.com/LukeWang95/yingnode-web.git"
INSTALL_DIR="/opt/yingnode"
NODE_VERSION="22"
SERVICE_NAME="yingnode"

# ---- 工具函数 ----
# 带重试和镜像回退的下载
download() {
    local url="$1"
    local output="$2"
    local mirror_url="$3"

    # 尝试原始 URL
    if curl -fsSL --connect-timeout 10 --retry 2 "$url" -o "$output" 2>/dev/null; then
        return 0
    fi

    # 回退到镜像
    if [ -n "$mirror_url" ]; then
        warn "主源连接失败，尝试镜像..."
        if curl -fsSL --connect-timeout 15 --retry 3 "$mirror_url" -o "$output" 2>/dev/null; then
            return 0
        fi
    fi

    return 1
}

# 克隆仓库（GitHub 优先，gitee 镜像回退）
clone_repo() {
    if git clone --depth 1 "$REPO" "$INSTALL_DIR" 2>/dev/null; then
        return 0
    fi
    warn "GitHub 克隆失败，尝试 Gitee 镜像..."
    if git clone --depth 1 "$REPO_MIRROR" "$INSTALL_DIR" 2>/dev/null; then
        # 切换 remote 回 GitHub
        cd "$INSTALL_DIR"
        git remote set-url origin "$REPO"
        return 0
    fi
    err "无法克隆仓库，请检查网络连接"
}

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
    # nodesource 国内可能慢，使用 npmmirror 的 Node.js 二进制镜像
    if ! curl -fsSL --connect-timeout 10 "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - 2>/dev/null; then
        warn "nodesource 不可用，尝试 n 版本管理器..."
        npm install -g n 2>/dev/null || true
        if command -v n &>/dev/null; then
            N_NODE_MIRROR=https://npmmirror.com/dist/node/ n "$NODE_VERSION"
        else
            err "无法安装 Node.js"
        fi
    fi
    apt-get install -y nodejs 2>/dev/null || true
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
        # 先获取当前 remote，尝试 pull
        git pull origin main 2>/dev/null || {
            warn "GitHub 更新失败，尝试 Gitee 镜像..."
            git remote add gitee "$REPO_MIRROR" 2>/dev/null || true
            git pull gitee main 2>/dev/null || warn "更新失败，继续使用当前版本"
        }
    else
        log "克隆仓库..."
        rm -rf "$INSTALL_DIR"
        clone_repo
        cd "$INSTALL_DIR"
    fi

    # 设置 npm 镜像（国内加速）
    if [ -n "${NPM_MIRROR:-}" ]; then
        npm config set registry "$NPM_MIRROR"
        log "npm 镜像: $NPM_MIRROR"
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
    BETTER_AUTH_URL="http://localhost:3000" npm run build

    # Next.js standalone 需手动复制 static 文件和 .env
    mkdir -p "$INSTALL_DIR/.next/standalone/.next"
    cp -r "$INSTALL_DIR/.next/static" "$INSTALL_DIR/.next/standalone/.next/static"
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
        # 加载已有配置供后续步骤使用
        set -a; . "$INSTALL_DIR/.env"; set +a
        return
    fi

    # 先生成密钥，确保 shell 变量可用（供 install_service 的 sed 使用）
    BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
    TERMINAL_TOKEN="$(openssl rand -base64 16)"

    log "创建 .env 配置..."
    cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}"
TERMINAL_TOKEN="${TERMINAL_TOKEN}"
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
            TTYD_URL="https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}"
            TTYD_MIRROR="https://fastly.jsdelivr.net/gh/tsl0922/ttyd@latest/ttyd.${TTYD_ARCH}"
            if ! download "$TTYD_URL" /usr/local/bin/ttyd "$TTYD_MIRROR"; then
                warn "ttyd 下载失败，跳过终端服务"
                return
            fi
            chmod +x /usr/local/bin/ttyd
            log "ttyd 安装完成"
        fi
    fi
    # Substitute TERMINAL_TOKEN in service file (use | delimiter to avoid base64 / conflict)
    if [ -n "${TERMINAL_TOKEN:-}" ]; then
        sed "s|\${TERMINAL_TOKEN}|${TERMINAL_TOKEN}|g" \
            "$INSTALL_DIR/deploy/yingnode-terminal.service" \
            > /etc/systemd/system/yingnode-terminal.service
        systemctl enable yingnode-terminal 2>/dev/null || warn "终端服务注册失败"
    else
        warn "TERMINAL_TOKEN 未设置，跳过终端服务"
    fi
}

# ---- 启动服务 ----
start_services() {
    log "启动服务..."
    systemctl restart yingnode
    if [ -f /etc/systemd/system/yingnode-terminal.service ]; then
        systemctl restart yingnode-terminal
    else
        warn "终端服务未安装，跳过"
    fi
    log "服务已启动"
}

# ---- 显示部署信息 ----
show_info() {
    LOCAL_IP=$(ip -4 addr show scope global 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "172.16.42.1")
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
