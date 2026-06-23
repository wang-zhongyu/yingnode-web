# Subagent 架构升级设计

> 日期：2026-06-23
> 状态：已批准

## 目标

将 yingnode-web 的开发工作流升级为「主 agent 计划 + 领域专家 subagent 执行」的架构，确保代码质量和规范一致性。

## 一、Subagent 体系

### 1.1 6 个领域专家

| Subagent | 文件名 | 职责 | 对应规范/知识 |
|----------|--------|------|-------------|
| shadcn-specialist | `.agents/shadcn-specialist.md` | 构建 shadcn/ui 组件、遵循 composition/styling/icons 规则 | `.agents/skills/shadcn/` 全部规则文件 |
| code-reviewer | `.agents/code-reviewer.md` | 严格按 code-review.md 的 15 个分类（【0】～【N】）逐条审查 | CODING-GUIDELINES.md + code-review.md |
| typescript-specialist | `.agents/typescript-specialist.md` | TypeScript 类型设计、Zod schema、泛型、类型推导 | 项目 tsconfig、CODING-GUIDELINES 类型约定 |
| nextjs-specialist | `.agents/nextjs-specialist.md` | App Router、Server Component、Server Action、next-safe-action、路由代理 | AGENTS.md Next.js 指南 + CODING-GUIDELINES 架构规则 |
| prisma-specialist | `.agents/prisma-specialist.md` | Prisma schema、migration、seed、SQLite 约束、better-auth 表保护 | `prisma/schema.prisma` + better-auth 规则 |
| network-specialist | `.agents/network-specialist.md` | 网络管理 feature（hostapd、dnsmasq、WiFi API、离线自愈） | `features/network/` + `config/` 配置文件 |

### 1.2 文件结构

```
.agents/
├── skills/                          # 已有 — shadcn/better-auth 等 skill 文件
├── shadcn-specialist.md             # 新增
├── code-reviewer.md                 # 新增
├── typescript-specialist.md         # 新增
├── nextjs-specialist.md             # 新增
├── prisma-specialist.md             # 新增
└── network-specialist.md            # 新增
```

### 1.3 Subagent 文件格式

每个 `.md` 文件包含 frontmatter（元数据）+ 系统指令：

```markdown
---
name: <kebab-case-name>
description: <一行描述 — 供 Agent 工具匹配使用>
model: inherit
tools: Read, Write, Edit, Bash, Glob, Grep
---

# <Display Name>

你是 <领域> 专家...

## 前置必读
- 执行任务前必须先读取 <规范文件列表>

## 强制规则
- <规则 1>
- <规则 2>

## 禁止行为
- <禁止 1>
```

## 二、CLAUDE.md 更新

### 2.1 新增章节：Subagent 调度规则

在现有「强制 Skill 调用规则」之后新增。

### 2.2 内容

- **核心原则**：主 agent 只做计划，不直接执行代码变更。所有 Write / Edit / 复杂 Bash 操作由领域专家 subagent 执行。
- **主 agent 职责**：理解需求、调用 brainstorming、制定计划、分派 subagent、汇总结果、调用 code-reviewer 验证。只读操作（Read、Glob、Grep）可直接执行。
- **分派表**：按任务类型匹配 subagent
- **例外规则**：主 agent 可直接执行的操作（单行 bug 修复、文件重命名/移动、读取/搜索、git 命令、安装依赖）
- **多领域任务处理**：串联调用多个 subagent，最后 code-reviewer 审查

### 2.3 分派表

| 任务类型 | Subagent | 触发条件 |
|---------|---------|---------|
| UI 组件构建 | `shadcn-specialist` | 新建/修改 shadcn 组件、样式、交互 |
| 代码审查 | `code-reviewer` | 任何代码变更完成后、/code-review |
| 类型/Schema | `typescript-specialist` | Zod schema、类型定义、泛型设计 |
| 页面/路由/API | `nextjs-specialist` | App Router 页面、Server Action、API route |
| 数据库 | `prisma-specialist` | Schema 变更、migration、seed |
| 网络功能 | `network-specialist` | features/network/ 相关所有变更 |

### 2.4 与现有规则的关系

- 「强制 Skill 调用规则」保留不变 — 控制 skill 调用时机
- 「Subagent 调度规则」为新增 — 控制任务执行方式
- 两者互补：先决定调用哪个 skill 做规划，再决定用哪个 subagent 执行

## 三、工作流示例

### 场景：添加新的网络配置功能

```
1. 用户: "添加静态 IP 配置功能"
2. 主 agent: 调用 superpowers:brainstorming → 理解需求
3. 主 agent: 调用 superpowers:writing-plans → 制定实现计划
4. 主 agent: 分派 network-specialist → 执行网络相关后端变更
5. 主 agent: 分派 shadcn-specialist → 构建 UI 表单
6. 主 agent: 分派 nextjs-specialist → 创建 API route
7. 主 agent: 分派 code-reviewer → 审查全部变更
8. 主 agent: 汇总结果，报告完成
```

### 场景：简单修复

```
1. 用户: "修复 use-mobile.ts 中的类型错误"
2. 主 agent: 判断为简单单文件修复 → 直接 Read + Edit 执行
```

## 四、非目标

- **不创建新的 skill** — 现有机能已通过 superpowers 技能体系 + `.agents/skills/` 覆盖
- **不修改 CODING-GUIDELINES.md 或 code-review.md** — 这两个文件标记为不可修改
- **不改变现有 superpowers SDD 流程** — 继续使用 `.superpowers/sdd/` 追踪任务进度
