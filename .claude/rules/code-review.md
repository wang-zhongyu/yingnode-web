# Code Review Skill

> ⚠️ 此文件为 Claude Code 的 Code Review Skill，禁止修改其内容。执行 code review 时严格按照本文件流程操作，不得跳过任何步骤。

---

## 触发方式

```
/code-review
/code-review <文件路径或目录>
```

未指定路径时，review 范围为当前 git diff（staged + unstaged）或用户在对话中提供的文件。

---

## 执行流程

### Step 1 — 读取规范

开始任何 review 前，必须先读取项目根目录的 `CODING_GUIDELINES.md`。若文件不存在，告知用户后终止，不得凭记忆推断规范内容。

### Step 2 — 确定 Review 范围

按以下优先级确定待 review 文件：

1. 用户明确指定的路径
2. `git diff --name-only HEAD`（已修改文件）
3. 用户在对话中粘贴的代码片段

列出所有待 review 文件，逐一执行 Step 3。

### Step 3 — 逐条检查

对每个文件，按以下 15 个分类（【0】～【N】）逐条检查，记录所有违规项。**每个分类都必须过一遍，即使该分类无问题。**

---

## 检查项清单

### 【0】底层原则

- [ ] 是否存在不必要的 `"use client"`——该组件无交互/状态，实际可以是 Server Component
- [ ] Server Component 是否直接获取数据，而非在 Client Component 中用 `useEffect` / `fetch`
- [ ] 单个组件是否存在超过 2 个 `useState`——应拆分子组件，各自管理自己的 state（禁止合并 state 为对象规避此规则）
- [ ] 是否存在可用 Server Component、事件处理函数或派生值替代的 `useEffect`
- [ ] 是否存在重复出现超过一次但未拆分的 UI 片段或函数逻辑
- [ ] 是否存在内联三元条件渲染（应改为显式 `if` 分支，极简单一条件除外）
- [ ] 是否存在嵌套 `if-else`（违规，应改为 Guard Clause 提前 return）
- [ ] 单个文件是否超过 150 行（超过时审视是否需要拆分）
- [ ] 组件是否承担超过一项职责（起名需要用"和"连接两个概念时，说明需要拆分）
- [ ] 项目使用 better-auth 时，认证/用户/权限/组织相关逻辑是否全部通过 better-auth 官方 API 实现
- [ ] better-auth 管理的表（`user`、`session`、`account` 等）是否被手动修改了表结构或字段（违规）
- [ ] migration 文件中是否存在覆盖 better-auth 表结构的操作（违规）

### 【A】目录与文件位置

- [ ] 业务组件是否放在 `features/` 或 `shared/components/`，而非 `/components/ui/`
- [ ] 业务 hook 是否放在 `features/[name]/hooks/` 或 `shared/hooks/`，而非根目录 `/hooks/`
- [ ] 业务工具函数是否放在 `features/[name]/lib/` 或 `shared/lib/`，而非根目录 `/lib/`
- [ ] `/components/ui/`、`/hooks/`、`/lib/` 中是否存在新增或修改的非 shadcn 文件（违规）
- [ ] Zod schema 是否放在对应 feature 的 `schemas/` 子目录（跨 feature 复用的放 `shared/lib/schemas/`）
- [ ] Server Action 是否放在 `/actions/` 目录
- [ ] `ModalButton` 是否放在 `shared/components/modal-button.tsx`，未在 feature 内重复实现
- [ ] DataTable 相关工具组件（`DataTableColumnHeader` 等）是否放在 `shared/components/`

### 【B】依赖方向

- [ ] `features/` 中是否存在跨 feature 直接导入（`import ... from "@/features/other-feature/..."`）（违规）
- [ ] `shared/` 中是否存在从 `features/` 导入的内容（违规）
- [ ] `app/page.tsx` 或 `app/layout.tsx` 是否直接包含业务逻辑而非引用 feature 组件

### 【C】组件结构与 shadcn 使用

- [ ] 单个组件文件是否只导出一个主组件
- [ ] 辅助子组件超过 50 行是否已拆分为独立文件
- [ ] 组件命名是否遵循 `[功能]-[类型].tsx`（如 `post-list.tsx`、`post-list-item.tsx`）
- [ ] 是否存在用 `div` / `span` / `p` 等原生元素自行实现已有 shadcn 组件功能的情况（违规）
- [ ] shadcn 组件是否通过 `className` 覆盖了内部样式（`bg-*`、`text-*` 颜色、`font-*`、`border-*` 颜色/圆角、`rounded-*`、`shadow-*`、`p-*`/`px-*`/`py-*`、内部 `gap-*`）（违规）
- [ ] shadcn 组件视觉变体是否通过 `variant` / `size` props 控制，而非 `className` 覆盖
- [ ] 是否使用前读取了 `.agent/` 中的 shadcn skill 文件（如有疑问，以 skill 文件为准）

### 【D】Modal / Sheet 架构

- [ ] `useModalStore` 中是否已注册新增的 `ModalType`
- [ ] 新增 Modal 是否已在 `app/_components/modal-provider.tsx` 中注册
- [ ] `xxx-modal` 是否不接收任何 props，只从 `useModalStore` 读取 `type`/`data`/`isOpen`/`close`
- [ ] `xxx-modal` 是否向子组件传递了业务回调（`onConfirm`、`onDelete` 等）（违规）
- [ ] 触发 Modal 的入口是否全部使用 `ModalButton`（`modalType` + 可选 `modalData`），未在业务组件中直接调用 `useModalStore`（违规）
- [ ] 表单逻辑是否直接写在了 Modal 组件内（违规，应拆分为独立 `xxx-form`）
- [ ] 子组件（form）是否自行调用 Action 并处理 toast，通过 `close()` 关闭 Modal
- [ ] AlertDialog 是否错误地注册到了 `ModalProvider` 或 `useModalStore`（违规）
- [ ] AlertDialog 的 `open` 状态是否由父组件本地 `useState` 管理，用 Fragment 并列渲染
- [ ] `xxx-alert-dialog` 是否只接收 `open`、`onOpenChange` 和数据 props，不接收业务回调

### 【E】表单规范

- [ ] 是否使用 `react-hook-form` + shadcn `Form` / `FormField` / `FormItem` / `FormControl` / `FormLabel` / `FormMessage` 完整组合
- [ ] 是否使用 `zod` + `zodResolver` 进行 schema 校验
- [ ] 是否使用了 `form.watch()`（违规，必须改为 `useWatch`）
- [ ] schema 是否单独放在对应 feature 的 `schemas/` 目录，未内联在组件文件中

### 【F】Server Action 与数据获取

- [ ] Server Action 是否使用 `next-safe-action` 定义
- [ ] 表单提交是否通过 `useAction` hook 调用，未使用原生 `action` 属性或手动 `fetch`
- [ ] 成功/失败反馈是否使用 shadcn `Sonner`（`toast`），未使用 `alert` 或自定义 toast
- [ ] Client Component 中的数据获取逻辑是否封装为独立 `useXxx` hook，未内联在组件内

### 【G】路由跳转与数据请求

- [ ] 是否存在在 `page.tsx`、`layout.tsx` 或组件内部的路由重定向逻辑（违规，应集中在 `proxy.ts`）
- [ ] `page.tsx` 是否作为 Server Component 数据层，负责获取数据并通过 props 传递给子组件
- [ ] `layout.tsx` 是否只负责骨架拼接，未包含业务逻辑
- [ ] Client Component 中是否存在本可在 `page.tsx` 中完成的数据请求（建议移至服务端）
- [ ] 如 Client Component 确需请求数据，是否已封装为独立 `useXxx` hook，未在组件内内联

### 【H】列表组件

- [ ] 使用 shadcn `Item` 构建的列表项，外层是否使用 `ItemGroup` 包裹（而非 `div`）
- [ ] 列表状态是否使用显式 `if` 分支（禁止内联三元 `isPending ? ... : ...`）
- [ ] 是否有配套的 `xxx-list-skeleton.tsx`
- [ ] 空状态是否使用 `ListEmpty` 组件，并传入 `icon`、`title`、`description`、`children`

### 【I】加载状态

- [ ] 非列表组件（Modal 内容、表单、详情面板）加载时是否使用局部 Skeleton 或 `SpinnerEmpty`
- [ ] 是否存在内联加载状态渲染（如 `{isLoading && <Spinner />}`，应改为显式 `if` 分支）

### 【J】确认操作（AlertDialog）

- [ ] 不可逆操作是否使用 `AlertDialogRoot` + `xxx-alert-dialog` 实现（禁止内联 `AlertDialog` 结构，禁止使用 `confirm()`）
- [ ] `AlertDialogContent` size 是否为 `max-w-sm`（在 `AlertDialogRoot` 中统一维护）
- [ ] `AlertDialogAction` 样式是否通过 `variant` prop 控制（如 `"destructive"`、`"default"`、`"outline"`），未使用 `className` 覆盖（违规）
- [ ] `xxx-alert-dialog` 是否向外暴露了 `onConfirm`、`onDeleted` 等业务回调（违规，逻辑应在内部处理）
- [ ] `xxx-alert-dialog` 是否在内部自行调用 Action 并处理 toast 和关闭状态

### 【K】逻辑复用与代码质量

- [ ] 是否存在重复出现超过一次的函数逻辑未拆分到 `lib/` 目录
- [ ] 是否存在嵌套 `if-else`（违规，必须改为 Guard Clause）
- [ ] 是否存在超过 3 层的条件嵌套

### 【L】Sidebar

- [ ] Sidebar 是否基于 shadcn `Sidebar` 系列组件构建（禁止自行实现）
- [ ] 是否按职责拆分为 `app-sidebar`、`sidebar-nav-main`、`sidebar-user` 等子文件
- [ ] `SidebarProvider` 是否在 `layout.tsx` 中包裹

### 【M】DataTable

- [ ] 是否有独立的 `xxx-table-columns.tsx` 文件定义 `ColumnDef` 数组
- [ ] 行操作是否拆分为独立的 `xxx-table-row-actions.tsx`，未内联在列定义中
- [ ] 排序是否使用 `getSortedRowModel()` + `DataTableColumnHeader`
- [ ] 分页是否使用 `getPaginationRowModel()` + `DataTablePagination`
- [ ] 列筛选是否使用 `getFilteredRowModel()` + `DataTableFacetedFilter`
- [ ] 全局搜索是否使用 `globalFilter` state，放在 Toolbar 中
- [ ] `DataTableColumnHeader`、`DataTablePagination` 等官方组件是否放在 `shared/components/`，未自行实现

### 【N】shadcn 组件 API 正确性

- [ ] Radix UI 组件（`DropdownMenuTrigger`、`DialogTrigger`、`TooltipTrigger` 等）是否使用 `asChild`，而非 `render` prop
- [ ] Base UI 组件是否使用 `render` prop，而非 `asChild`
- [ ] `DropdownMenuItem` 是否全部放在 `DropdownMenuGroup` 中，分组间使用 `DropdownMenuSeparator`
- [ ] `Select` 已选值是否手动渲染，未依赖 `SelectValue` 自动回显自定义内容
- [ ] `Command` 的选择事件是否使用 `onSelect`，而非 `onClick`
- [ ] `Tooltip` 是否在 `TooltipProvider` 内使用
- [ ] `RadioGroup` 是否通过 `value` + `onValueChange` 受控，未依赖原生 `onChange`

---

## 输出格式

Review 完成后，按以下结构输出报告：

```
## Code Review 报告

### 📁 Review 范围
列出所有 review 的文件路径

### 🔴 必须修复（违反强制规范）
格式：
> [分类] 文件路径:行号
> 问题描述
> 修复建议（附正确写法示例）

### 🟡 建议改进（不违反规范但影响质量）
格式：
> 文件路径:行号
> 问题描述
> 建议

### ✅ 通过项
本次 review 中符合规范的关键点（不超过 5 条）

### 📋 修复优先级
按 🔴 条目数量和影响范围排序，列出建议修复顺序
```

---

## 严重级别定义

| 级别 | 标记 | 说明 |
|------|------|------|
| 必须修复 | 🔴 | 违反 CODING_GUIDELINES 中的强制规则，不修复不得合并 |
| 建议改进 | 🟡 | 不违反规范但影响可维护性、性能或一致性 |
| 通过 | ✅ | 符合规范，无需处理 |

---

## 附加行为规则

- **不得自动修复**：review 结束后只输出报告，不得自动修改任何文件，除非用户明确要求。
- **不得遗漏分类**：15 个检查分类（【0】～【N】）必须全部过一遍，即使该分类无问题也需在内部确认。
- **引用行号**：每条问题必须引用具体文件路径和行号，不得泛泛描述。
- **不得修改本文件**：此 skill 文件本身为只读，任何情况下不得修改。
