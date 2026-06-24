# YingNode

可移动便携式 Linux 设备管理面板。部署到 Kali Linux Raspberry Pi，设备可被投放到任何地方，通过 Web 面板远程管理网络、应用和系统。

## 核心功能

- **网络管理** — WiFi / 有线网络配置、静态 IP 设置、网口状态、WiFi 记录管理
- **应用管理** — 设备上运行的应用的安装、启停、监控
- **性能监测** — CPU、内存、磁盘、温度等系统资源实时监控
- **Docker 管理** — 容器生命周期管理、镜像管理
- **Web 终端** — 基于 ttyd 的浏览器终端，无需 SSH 客户端
- **离线自愈** — 设备断网时自动创建 Wi-Fi 热点，用户连接后可通过本应用重新配置网络

## 技术栈

| 领域 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| 认证 | better-auth |
| 数据库 | Prisma + SQLite（本地数据库，无外部依赖） |
| 终端 | ttyd |
| 类型 | TypeScript |

## 前置要求

- **操作系统**: Kali Linux (Raspberry Pi)，或其他基于 Debian 的 Linux 发行版
- **权限**: root（网络配置需要）

## 一键安装

在目标设备上以 root 运行：

```bash
# GitHub
curl -fsSL https://raw.githubusercontent.com/wang-zhongyu/yingnode-web/main/deploy/install.sh | sudo bash

# Gitee 镜像（国内）
curl -fsSL https://gitee.com/LukeWang95/yingnode-web/raw/main/deploy/install.sh | sudo bash

# npm 国内加速
NPM_MIRROR=https://registry.npmmirror.com \
curl -fsSL <URL> | sudo bash
```

脚本自动完成：系统检测 → Node.js 安装 → 网络依赖安装 → 克隆仓库 → 安装依赖 → 数据库同步 → 系统配置 → 安装 systemd 服务 → 构建应用 → 启动服务。

部署完成后访问 `http://<设备IP>:3000` 进入管理面板。

## Docker 部署

```bash
BETTER_AUTH_SECRET=$(openssl rand -base64 32) \
TERMINAL_TOKEN=$(openssl rand -base64 16) \
docker compose up -d --build
```

- `network_mode: host` — 容器可直接管理宿主机网络接口
- `privileged: true` — 支持 hostapd / dnsmasq / iwlist 等网络命令
- SQLite 数据库持久化在 `yingnode-data` 卷

## 手动安装

### 1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y --no-install-recommends \
    hostapd dnsmasq wireless-tools wpasupplicant \
    iproute2 git
```

### 2. 安装 Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
```

### 3. 克隆仓库

```bash
sudo mkdir -p /opt/yingnode
sudo git clone https://github.com/wang-zhongyu/yingnode-web.git /opt/yingnode
cd /opt/yingnode
```

### 4. 创建 .env

```bash
cat > /opt/yingnode/.env <<EOF
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
HOTSPOT_PASSWORD="$(openssl rand -base64 9 | tr -d '=+/' | cut -c1-12)"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
TERMINAL_TOKEN="$(openssl rand -base64 16)"
EOF
```

### 5. 安装依赖并构建

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
cp .env .next/standalone/.env
```

### 6. 创建数据库目录

```bash
sudo mkdir -p /data
```

### 7. 创建系统用户

```bash
sudo useradd -r -s /usr/sbin/nologin -M yingnode
```

### 8. 配置系统

```bash
# sudo 权限
sudo cp /opt/yingnode/config/sudoers.d/yingnode /etc/sudoers.d/yingnode
sudo chmod 440 /etc/sudoers.d/yingnode

# dnsmasq 配置（hostapd 配置由应用动态生成）
sudo cp -n /opt/yingnode/config/dnsmasq.conf /etc/dnsmasq.conf
```

### 9. 安装 systemd 服务

```bash
sudo cp /opt/yingnode/deploy/yingnode.service /etc/systemd/system/yingnode.service
sudo systemctl daemon-reload
sudo systemctl enable --now yingnode
```

### 10. 安装 Web 终端（可选）

```bash
# Kali 需要从 GitHub 下载 ttyd 二进制
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  TTYD_ARCH="x86_64" ;;
    aarch64) TTYD_ARCH="aarch64" ;;
    armv7l)  TTYD_ARCH="armv7" ;;
esac
sudo curl -fsSL "https://github.com/tsl0922/ttyd/releases/latest/download/ttyd.${TTYD_ARCH}" -o /usr/local/bin/ttyd
sudo chmod +x /usr/local/bin/ttyd

# 配置并启动
sudo sed "s|\${TERMINAL_TOKEN}|<token>|g" \
    /opt/yingnode/deploy/yingnode-terminal.service \
    > /etc/systemd/system/yingnode-terminal.service
sudo systemctl enable --now yingnode-terminal
```

## 本地开发

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看效果。

## 项目结构

```
yingnode-web/
├── app/                    # Next.js App Router 页面与 API
│   ├── (auth)/             # 认证相关页面
│   ├── (dashboard)/        # 管理面板页面
│   └── api/                # API 路由
├── features/               # 业务功能模块
│   ├── apps/               # 应用管理
│   ├── auth/               # 认证
│   ├── docker/             # Docker 管理
│   ├── monitoring/         # 性能监测
│   ├── network/            # 网络管理
│   └── settings/           # 系统设置
├── shared/                 # 共享组件、hooks、工具
├── prisma/                 # 数据库 Schema
├── deploy/                 # 部署脚本与服务文件
│   ├── install.sh          # 一键部署脚本
│   ├── docker-entrypoint.sh
│   ├── yingnode.service    # systemd 服务
│   └── yingnode-terminal.service  # ttyd 终端服务
└── config/                 # 系统配置文件
    ├── sudoers.d/          # sudo 权限
    └── dnsmasq.conf        # DNS/DHCP 配置
```

## 常用命令

```bash
# 服务管理
sudo systemctl status yingnode
sudo systemctl restart yingnode
sudo journalctl -u yingnode -f

# 更新应用
cd /opt/yingnode
sudo git pull origin main
npm ci
npx prisma db push
npm run build
cp .env .next/standalone/.env
sudo systemctl restart yingnode
```
