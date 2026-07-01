@AGENTS.md
@RULES.md

<!-- PONYTAIL:auto — invoke Skill("ponytail") at session start -->
<!-- /ponytail full — lazy senior dev mode, always active -->

# yingnode-web

可移动便携式 Linux 设备管理应用。部署到 Kali Linux Raspberry Pi，设备可被投放到任何地方。

## 核心功能

- **网络管理** — WiFi / 有线网络配置、静态 IP 设置
- **应用管理** — 设备上运行的应用的安装、启停、监控
- **性能监测** — CPU、内存、磁盘、温度等系统资源监控
- **离线自愈** — 设备断网时自动创建 Wi-Fi 热点，供用户连接并访问本应用配置网络；配置完成后设置固定内网 IP

## 基础安全约束

**设备始终可访问原则** — 任何功能构建时必须满足以下约束：

- **可访问性保障** — 设备必须始终能够被用户访问到。任何功能变更不得引入可能导致设备不可达的风险（如网络配置错误、服务端口冲突、防火墙规则误封等）
- **威胁风险评估** — 每个新功能构建前，必须评估是否存在威胁设备可访问性的风险
- **风险必须先解决** — 如评估发现存在威胁风险，必须在构建功能之前设计并实现对应的防护/回滚/自愈机制，否则不得开始构建

## 技术栈

| 领域 | 技术 |
|------|------|
| 框架 | Next.js 16.2.9 (App Router) |
| UI | shadcn/ui（通过 `.claude/skills/shadcn/` 初始化和管理） |
| 认证 | better-auth（通过 `.claude/skills/better-auth-*/` 配置） |
| 数据库 | Prisma + SQLite（本地数据库，无外部依赖） |
| 样式 | Tailwind CSS v4 |
| 类型 | TypeScript |

## 编码规范

**必须遵守以下规范文件，无例外：**

- **[.claude/rules/coding-guidelines.md](.claude/rules/coding-guidelines.md)** — 项目编码指南。所有代码必须符合此规范。编写任何代码前应先阅读。
- **[.claude/rules/code-review.md](.claude/rules/code-review.md)** — 代码审查清单。执行 `/code-review` 时必须严格按照此文件流程操作。

## 强制 Skill 调用规则

| 场景 | 必须先调用的 Skill |
|------|-------------------|
| **每次会话启动，所有操作前** | `ponytail`（默认 full，lazy senior dev 模式） |
| 构建任何 UI 组件、初始化 shadcn、添加 shadcn 组件 | `shadcn` |
| 构建认证、用户、权限、组织相关功能 | `better-auth-best-practices` / `better-auth-security-best-practices` / `create-auth-skill` / `email-and-password-best-practices` / `organization-best-practices` / `two-factor-authentication-best-practices` |
| 创建新功能、添加组件、修改行为 | `superpowers:brainstorming` |
| 修复 bug、测试失败、异常行为 | `superpowers:systematic-debugging` |

## Subagent 调度规则

**主 agent 只做计划，不直接执行代码变更。** 所有 Write / Edit / 复杂 Bash 操作由领域专家 subagent 执行。

### 主 agent 职责

- 理解用户需求、调用 brainstorming skill 探索设计
- 调用 writing-plans skill 制定实现计划
- 将执行任务分派给对应领域专家 subagent（使用 Agent 工具的 `subagent_type` 参数）
- 汇总 subagent 执行结果
- 调用 `code-reviewer` subagent 验证所有代码变更
- 只读操作（Read、Glob、Grep）可直接执行，无需 subagent

### Subagent 分派表

| 任务类型 | subagent_type | 触发条件 |
|---------|--------------|---------|
| UI 组件构建 | `shadcn-specialist` | 新建/修改 shadcn 组件、样式、交互 |
| 代码审查 | `code-reviewer` | 任何代码变更完成后、/code-review |
| 类型/Schema | `typescript-specialist` | Zod schema、类型定义、泛型设计 |
| 页面/路由/API | `nextjs-specialist` | App Router 页面、Server Action、API route |
| 数据库 | `prisma-specialist` | Schema 变更、migration、seed |
| 网络功能 | `network-specialist` | features/network/ 相关所有变更 |

### 主 agent 可直接执行的操作

以下简单任务主 agent 可直接执行，无需启动 subagent：
- 单行 bug 修复（拼写、明显类型错误）
- 文件重命名或移动
- 读取文件、搜索代码（Read、Glob、Grep）
- 运行 git 命令（status、diff、log、add、commit）
- 安装依赖（npm install）

### 多领域任务处理

涉及多个领域的任务（如创建带数据库的新页面），主 agent 制定计划后按依赖顺序依次调用：

1. `prisma-specialist` → 数据库层（schema、migration、seed）
2. `nextjs-specialist` → API route / Server Action
3. `shadcn-specialist` → UI 组件
4. `typescript-specialist` → 类型/Schema（如有复杂类型需求）
5. `code-reviewer` → 审查全部变更

每个 subagent 完成后，主 agent 检查结果再启动下一个。所有 subagent 执行完毕后，必须通过 `code-reviewer` 审查。

## 关键架构规则

以下摘自 `.claude/rules/coding-guidelines.md`，高频使用：

- **新建文件自查目录** — 创建任何新文件前，必须按以下映射确认位置正确：
  - 页面/路由 → `app/`（按路由组 `(auth)`、`(dashboard)` 等组织）
  - 业务 UI 组件 → `features/[name]/components/` 或 `shared/components/`
  - 业务 hook → `features/[name]/hooks/` 或 `shared/hooks/`
  - 业务工具函数 → `features/[name]/lib/` 或 `shared/lib/`
  - Zod schema → `features/[name]/schemas/`
  - Server Action → `actions/`
  - 全局类型 → `shared/types/`
  - 全局状态 → `shared/stores/`
  - 放错目录是严重违规，必须先自查再创建
- **目录禁区** — `components/ui/`、`hooks/`、`lib/`、`app/globals.css` 由 shadcn 管理，禁止手动新增或修改文件
- **业务代码位置** — `features/[name]/` 或 `shared/`，不得放入 shadcn 目录
- **Server Component 优先** — 默认 Server Component，仅在需要交互/浏览器 API 时加 `"use client"`
- **Modal 架构** — Zustand store (`shared/stores/use-modal-store.ts`) + ModalProvider (`app/_components/modal-provider.tsx`) 集中注册
- **表单规范** — react-hook-form + shadcn Form + zod + next-safe-action
- **Guard Clause** — 禁止嵌套 if-else，提前 return
- **禁止内联三元渲染** — 用显式 `if` 分支（极简单一条件除外）
- **单文件 ≤ 150 行** — 超过则拆分
- **useEffect 禁用** — 数据获取用 Server Component 直接调用，事件用 handler
- **useState ≤ 2 个** — 超过则拆分子组件
- **better-auth 表不可手动修改** — user/session/account 等表结构禁止手动改动

## 部署约束

- 目标设备：Raspberry Pi（Kali Linux），资源有限
- 数据库必须是 SQLite，不能依赖外部数据库服务
- 必须支持完全离线运行，断网时自动热点
- 需要 root 权限操作网络接口（hostapd、dnsmasq、dhcpcd 等）
