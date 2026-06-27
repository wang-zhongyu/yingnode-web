#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# YingNode 一键部署脚本
#
# 快速开始:
#   curl -fsSL https://raw.githubusercontent.com/wang-zhongyu/yingnode-web/main/deploy/install.sh | sudo bash
#
# 环境变量 (非交互模式):
#   REPO_SOURCE=github|gitee   仓库源选择
#   NPM_SOURCE=official|mirror npm 源选择
#   NPM_MIRROR=<url>           自定义 npm 镜像 (兼容旧用法)
#   REINSTALL=overwrite|update|rebuild|abort  已安装时的行为
#
# 示例:
#   # 国内环境非交互部署
#   REPO_SOURCE=gitee NPM_SOURCE=mirror curl -fsSL <URL> | sudo bash
#
#   # 更新已有部署
#   REINSTALL=update curl -fsSL <URL> | sudo bash
# ============================================================

REPO_GITHUB="https://github.com/wang-zhongyu/yingnode-web.git"
REPO_GITEE="https://gitee.com/LukeWang95/yingnode-web.git"
REPO_URL=""  # set by select_sources()
INSTALL_DIR="/opt/yingnode"
NODE_VERSION="22"
SERVICE_NAME="yingnode"

# ---- 交互辅助函数 ----
# 交互模式: 从 /dev/tty 读取用户输入
# 非交互模式 (CI/管道): 从同名环境变量读取，未设则返回默认值
prompt() {
    local env_var="$1"
    local message="$2"
    local default="$3"

    # 非交互模式 — 检查环境变量
    if [ ! -t 0 ] || [ ! -c /dev/tty ]; then
        local env_val
        env_val="$(printenv "$env_var" 2>/dev/null || true)"
        if [ -n "$env_val" ]; then
            echo "  [非交互] $env_var=$env_val" >&2
            echo "$env_val"
            return
        fi
        echo "  [非交互] $env_var 未设置，使用默认值: $default" >&2
        echo "$default"
        return
    fi

    # 交互模式 — 从 /dev/tty 读
    printf "%s [%s]: " "$message" "$default" > /dev/tty
    read -r answer < /dev/tty || true
    echo "${answer:-$default}"
}

# ---- 源选择 ----
select_sources() {
    # --- 仓库源 ---
    # 环境变量优先
    if [ -n "${REPO_SOURCE:-}" ]; then
        case "${REPO_SOURCE}" in
            gitee|Gitee)
                REPO_URL="$REPO_GITEE"
                log "仓库源: Gitee (环境变量)"
                ;;
            *)
                REPO_URL="$REPO_GITHUB"
                log "仓库源: GitHub (环境变量)"
                ;;
        esac
    elif [ "${NET_GITHUB_OK:-true}" = false ]; then
        REPO_URL="$REPO_GITEE"
        log "仓库源: Gitee (自动检测)"
    else
        REPO_URL="$REPO_GITHUB"
        log "仓库源: GitHub (自动检测)"
    fi

    # --- npm 源 (NPM_MIRROR 环境变量优先，兼容旧用法) ---
    if [ -n "${NPM_MIRROR:-}" ]; then
        NPM_REGISTRY="$NPM_MIRROR"
        log "npm 镜像: $NPM_MIRROR (来自 NPM_MIRROR 环境变量)"
        case "$NPM_MIRROR" in
            *npmmirror*|*taobao*) NPM_MIRROR_NODE=true ;;
            *) NPM_MIRROR_NODE=false ;;
        esac
        return
    fi

    if [ -n "${NPM_SOURCE:-}" ]; then
        case "${NPM_SOURCE}" in
            mirror|镜像)
                NPM_REGISTRY="https://registry.npmmirror.com"
                NPM_MIRROR_NODE=true
                log "npm 源: 国内镜像 (环境变量)"
                ;;
            *)
                NPM_REGISTRY="https://registry.npmjs.org"
                NPM_MIRROR_NODE=false
                log "npm 源: 官方 (环境变量)"
                ;;
        esac
    elif [ "${NET_NPM_OK:-true}" = false ]; then
        NPM_REGISTRY="https://registry.npmmirror.com"
        NPM_MIRROR_NODE=true
        log "npm 源: 国内镜像 (自动检测)"
    else
        NPM_REGISTRY="https://registry.npmjs.org"
        NPM_MIRROR_NODE=false
        log "npm 源: 官方 (自动检测)"
    fi
}

# ---- 已安装检测 ----
check_installed() {
    if [ ! -d "$INSTALL_DIR/.git" ]; then
        return 1  # 未安装 → 全新安装
    fi

    local ts
    ts=$(stat -c %y "$INSTALL_DIR/.git" 2>/dev/null || echo "未知时间")
    warn "检测到已安装 (${ts})"

    local action
    action=$(prompt "REINSTALL" \
        "检测到已安装，请选择: [1]覆盖安装 [2]更新代码 [3]重新构建 [4]退出" \
        "2")

    case "${action}" in
        1|overwrite)
            log "停止服务并清空目录..."
            systemctl stop "$SERVICE_NAME" yingnode-terminal 2>/dev/null || true
            rm -rf "$INSTALL_DIR"
            return 1  # 走向全新安装流程
            ;;
        2|update)
            log "将更新代码并重新构建..."
            SKIP_DB_RESET=true
            return 0  # 走向 deploy_app (git pull 分支)
            ;;
        3|rebuild)
            log "将跳过代码更新，仅重新构建..."
            SKIP_CLONE=true
            SKIP_DB_RESET=true
            return 0
            ;;
        *)
            log "已取消，退出。"
            exit 0
            ;;
    esac
}

# ---- 工具函数 ----
# 下载文件（带超时和重试）
download() {
    local url="$1"
    local output="$2"

    if curl -fsSL --connect-timeout 10 --retry 2 "$url" -o "$output" 2>/dev/null; then
        return 0
    fi
    return 1
}

# ---- 网络探测 ----
# TCP 端口探测（3s 超时）
probe_tcp() {
    local host="$1"
    local port="$2"
    timeout 3 bash -c "echo >/dev/tcp/${host}/${port}" 2>/dev/null
}

# HTTP 请求探测（3s 连接 + 5s 总超时）
probe_http() {
    local url="$1"
    curl -fsSL --connect-timeout 3 --max-time 5 "$url" -o /dev/null 2>/dev/null
}

# ---- 自动网络检测 ----
detect_network() {
    log "检测网络环境..."

    # --- 探测 GitHub ---
    if probe_tcp "github.com" 443 && probe_http "https://github.com"; then
        NET_GITHUB_OK=true
        log "  GitHub: 可达"
    else
        NET_GITHUB_OK=false
        warn "  GitHub: 不可达，将使用 Gitee 镜像"
    fi

    # --- 探测 npm registry ---
    if probe_tcp "registry.npmjs.org" 443 && probe_http "https://registry.npmjs.org/"; then
        NET_NPM_OK=true
        log "  npm registry: 可达"
    else
        NET_NPM_OK=false
        warn "  npm registry: 不可达，将使用 npmmirror 镜像"
    fi

    # --- 探测 APT 源 ---
    if probe_tcp "deb.debian.org" 80; then
        NET_APT_OK=true
        log "  APT 源: 可达"
    else
        NET_APT_OK=false
        warn "  APT 源: 不可达，将使用清华镜像"
    fi
}

# 克隆仓库 — 使用选定的源，失败时给出明确指引
clone_repo() {
    log "从 $REPO_URL 克隆仓库..."
    if git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" 2>/dev/null; then
        return 0
    fi
    err "无法克隆仓库。请检查网络连接，或设置 REPO_SOURCE=gitee 使用国内镜像重试"
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
            if [ "${NPM_MIRROR_NODE:-false}" = true ]; then
                N_NODE_MIRROR=https://npmmirror.com/dist/node/ n "$NODE_VERSION"
            else
                n "$NODE_VERSION"
            fi
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
    if [ "${SKIP_CLONE:-false}" = true ]; then
        log "跳过代码更新，使用当前代码..."
        cd "$INSTALL_DIR"
    elif [ -d "$INSTALL_DIR/.git" ]; then
        log "更新已有仓库..."
        cd "$INSTALL_DIR"
        git remote set-url origin "$REPO_URL"
        git pull origin main 2>/dev/null || \
            warn "更新失败，继续使用当前版本"
    else
        log "克隆仓库..."
        rm -rf "$INSTALL_DIR"
        clone_repo
        cd "$INSTALL_DIR"
    fi

    # 设置 npm 源
    if [ -n "${NPM_REGISTRY:-}" ]; then
        npm config set registry "$NPM_REGISTRY"
        log "npm registry: $NPM_REGISTRY"
    fi

    log "安装依赖..."
    npm ci

    log "生成 Prisma Client..."
    npx prisma generate

    if [ "${SKIP_DB_RESET:-false}" = true ]; then
        log "保留现有数据库..."
        mkdir -p /data
        npx prisma db push
    else
        log "同步数据库结构..."
        mkdir -p /data
        warn "重置数据库以清除残留认证数据（生产环境请备份后手动迁移）"
        rm -f /data/yingnode.db /data/yingnode.db-journal
        npx prisma db push
    fi
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

    # hostapd 和 dnsmasq 配置由应用动态生成，不再需要复制静态文件
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
    HOTSPOT_PASSWORD="$(openssl rand -base64 9 | tr -d '=+/' | cut -c1-12)"

    log "创建 .env 配置..."
    mkdir -p "$INSTALL_DIR"
    cat > "$INSTALL_DIR/.env" <<EOF
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
HOTSPOT_PASSWORD="${HOTSPOT_PASSWORD}"
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
            TTYD_CDN="https://fastly.jsdelivr.net/gh/tsl0922/ttyd@latest/ttyd.${TTYD_ARCH}"
            if ! download "$TTYD_URL" /usr/local/bin/ttyd; then
                warn "GitHub 下载失败，尝试 CDN 镜像..."
                if ! download "$TTYD_CDN" /usr/local/bin/ttyd; then
                    warn "ttyd 下载失败，跳过终端服务"
                    return
                fi
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
    # Load HOTSPOT_PASSWORD from .env if not already in env
    if [ -z "${HOTSPOT_PASSWORD:-}" ] && [ -f "$INSTALL_DIR/.env" ]; then
        set -a; . "$INSTALL_DIR/.env"; set +a
    fi
    echo ""
    log "============================================"
    log "  YingNode 部署完成!"
    log "============================================"
    log "  Web 面板:     http://${LOCAL_IP}:3000"
    log "  热点 SSID:    yingnode"
    log "  热点密码:     ${HOTSPOT_PASSWORD:-未设置}"
    log "  热点 IP:      172.16.42.1"
    log "  ----------------------------------------"
    log "  服务状态:     systemctl status yingnode"
    log "  查看日志:     journalctl -u yingnode -f"
    log "  安装源:       ${REPO_URL##*/}"
    log "============================================"
}

# ---- 主流程 ----
main() {
    if [ "$(id -u)" -ne 0 ]; then
        err "请用 root 运行: curl ... | sudo bash"
    fi

    log "YingNode 一键部署开始..."
    detect_os
    select_sources

    if check_installed; then
        # 已安装 — 更新/重建路径
        if [ "${SKIP_CLONE:-false}" = true ]; then
            # 仅重建: 跳过 install_node/install_network_deps/create_user
            deploy_app
            build_app
            post_install
            start_services
            show_info
            return
        fi
        # 更新代码
        install_node
        install_network_deps
        deploy_app
        configure_env
        configure_system
        install_service
        build_app
        post_install
        start_services
        show_info
        return
    fi

    # 全新安装
    install_node
    install_network_deps
    create_user
    deploy_app
    configure_env
    configure_system
    install_service
    build_app
    post_install
    start_services
    show_info
}

main "$@"
