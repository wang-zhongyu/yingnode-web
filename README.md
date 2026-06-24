# YingNode

可移动便携式 Linux 设备管理面板。部署到 Kali Linux Raspberry Pi，设备可被投放到任何地方，通过 Web 面板远程管理网络、应用和系统。

## 核心功能

- **网络管理** — WiFi / 有线网络配置、静态 IP 设置
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

- **Node.js** ≥ 22
- **系统依赖**: `hostapd` `dnsmasq` `wireless-tools` `wpasupplicant` `iproute2` `git`
- **操作系统**: Kali Linux (Raspberry Pi)，或其他基于 Debian 的 Linux 发行版
- **权限**: root（网络配置需要）

## 一键安装

在目标设备上以 root 运行：

```bash
curl -fsSL https://raw.githubusercontent.com/wang-zhongyu/yingnode-web/main/deploy/install.sh | sudo bash
```

脚本会自动完成：
1. 检测系统环境
2. 安装 Node.js 22（如未安装）
3. 安装网络管理依赖（hostapd、dnsmasq 等）
4. 创建 `yingnode` 系统用户
5. 克隆仓库到 `/opt/yingnode` 并构建
6. 写入系统配置和环境变量
7. 安装并启动 systemd 服务
8. 安装并启动 ttyd Web 终端服务

部署完成后访问 `http://<设备IP>:3000` 进入管理面板。

## 手动安装

### 1. 安装系统依赖

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
    hostapd dnsmasq wireless-tools wpasupplicant \
    iproute2 git ttyd
```

### 2. 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
```

### 3. 克隆仓库

```bash
sudo mkdir -p /opt/yingnode
sudo git clone https://github.com/wang-zhongyu/yingnode-web.git /opt/yingnode
cd /opt/yingnode
```

### 4. 安装依赖并构建

```bash
npm ci --omit=dev
npx prisma generate --no-engine
npm run build
```

### 5. 配置环境变量

创建 `/opt/yingnode/.env`：

```bash
DATABASE_URL="file:/data/yingnode.db"
WIFI_INTERFACE="wlan0"
HOTSPOT_SSID="yingnode"
HOTSPOT_IP="172.16.42.1"
BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
BETTER_AUTH_URL="http://172.16.42.1:3000"
TERMINAL_TOKEN="$(openssl rand -base64 16)"
```

> `BETTER_AUTH_URL` 使用固定内网 IP `172.16.42.1`，该 IP 始终绑定在 wlan0 上，无论设备处于热点模式还是连接到外部 WiFi 都能访问。

### 6. 创建数据库目录

```bash
sudo mkdir -p /data
sudo chown yingnode:yingnode /data
```

### 7. 创建系统用户

```bash
sudo useradd -r -s /usr/sbin/nologin -M yingnode
```

### 8. 配置 sudo 权限

```bash
sudo cp /opt/yingnode/config/sudoers.d/yingnode /etc/sudoers.d/yingnode
sudo chmod 440 /etc/sudoers.d/yingnode
```

### 9. 配置 hostapd / dnsmasq（可选）

```bash
sudo cp -n /opt/yingnode/config/hostapd.conf /etc/hostapd/hostapd.conf
sudo cp -n /opt/yingnode/config/dnsmasq.conf /etc/dnsmasq.conf
```

### 10. 安装 systemd 服务

```bash
sudo cp /opt/yingnode/deploy/yingnode.service /etc/systemd/system/yingnode.service
sudo systemctl daemon-reload
sudo systemctl enable yingnode
sudo systemctl start yingnode

# 配置并启动 ttyd Web 终端
sudo sed "s/\${TERMINAL_TOKEN}/<你的TERMINAL_TOKEN>/g" \
    /opt/yingnode/deploy/yingnode-terminal.service \
    > /etc/systemd/system/yingnode-terminal.service
sudo systemctl enable yingnode-terminal
sudo systemctl start yingnode-terminal
```

### 11. 验证部署

```bash
sudo systemctl status yingnode
sudo systemctl status yingnode-terminal
journalctl -u yingnode -f
```

访问 `http://<设备IP>:3000` 进入管理面板。

## Docker 部署

如果你更倾向于使用 PostgreSQL 作为数据库，可以使用 Docker Compose：

```bash
# 设置环境变量
export DB_PASSWORD="your-db-password"
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)"
export BETTER_AUTH_URL="http://172.16.42.1:3000"

# 启动
docker compose up -d
```

> 注意：Docker 部署使用 PostgreSQL 数据库。Raspberry Pi 推荐使用默认的 SQLite 本地部署方式。

## 本地开发

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 启动开发服务器
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
│   ├── settings/           # 系统设置
│   └── terminal/           # Web 终端
├── shared/                 # 共享组件、hooks、工具
├── prisma/                 # 数据库 Schema
├── deploy/                 # 部署脚本与服务文件
│   ├── install.sh          # 一键部署脚本
│   ├── yingnode.service    # systemd 服务
│   └── yingnode-terminal.service  # ttyd 终端服务
└── config/                 # 系统配置文件
    ├── sudoers.d/          # sudo 权限
    ├── hostapd.conf        # Wi-Fi 热点配置
    └── dnsmasq.conf        # DNS/DHCP 配置
```

## 常用命令

```bash
# 查看服务状态
sudo systemctl status yingnode

# 查看日志
sudo journalctl -u yingnode -f

# 重启服务
sudo systemctl restart yingnode

# 更新应用
cd /opt/yingnode
sudo git pull origin main
npm ci --omit=dev
npm run build
sudo systemctl restart yingnode
```
