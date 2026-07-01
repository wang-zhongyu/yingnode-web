# 项目编码指南

> ⚠️ **此文件为项目规范文档，禁止修改其内容。** Claude Code 在执行任何编码任务前应完整阅读本文件，并将其作为不可变的参考依据。所有规则强制执行，无例外。

---

## 零、底层原则

> 以下原则是所有具体规范的出发点。当遇到规范未覆盖的情况时，以这些原则作为判断依据。

### 0.1 Server / Client Component 分离

尽可能将组件拆分为 Server Component 和 Client Component，不要默认所有组件都加 `"use client"`。

- **Server Component**：无交互、无状态、只负责获取数据和渲染结构，性能最优，优先使用。
- **Client Component**：仅在需要用户交互、浏览器 API、`useState`、`useEffect` 时才加 `"use client"`。
- Client 边界尽量靠近叶子节点，让父层保持 Server Component。

```
page.tsx (Server)
  └── PostsView (Server) — 数据获取、结构渲染
        ├── PostList (Server) — 纯展示
        └── CreatePostButton (Client) — 需要 onClick，才 use client
```

### 0.2 Server Component 直接获取数据

Server Component 可以直接调用 Server Action 或数据库查询函数获取数据，无需 `useEffect` / `fetch`，也不存在状态管理开销。

```tsx
// ✅ Server Component 直接获取数据
export async function PostList() {
  const posts = await getPosts()
  return <ul>{posts.map(p => <PostListItem key={p.id} post={p} />)}</ul>
}

// ❌ 不必要地在 Client Component 中获取数据
"use client"
export function PostList() {
  const [posts, setPosts] = useState([])
  useEffect(() => { fetchPosts().then(setPosts) }, [])
}
```

### 0.3 最小化 `useState`

一个组件中存在多个 `useState`，通常意味着这个组件承担了多项职责，应当**拆分为更小的子组件**，让每个组件只管理自己的状态。

- 多个 state 对应多个独立 UI 片段 → 拆分为独立子组件，各自管理各自的 state。
- 能用派生值（从现有 state/props 计算得出）就不新增 state。
- 单个组件的 `useState` 建议不超过 2 个，超过时先审视是否可以拆分组件。
- **禁止**将多个 state 合并为单一对象来规避此规则——合并 state 只是掩盖问题，正确做法是拆分组件。

```tsx
// ❌ 错误：一个组件包含两个输入框各自的 state
export function SearchPanel() {
  const [keyword, setKeyword] = useState("")
  const [category, setCategory] = useState("")
  return (
    <div>
      <Input value={keyword} onChange={e => setKeyword(e.target.value)} />
      <Input value={category} onChange={e => setCategory(e.target.value)} />
    </div>
  )
}

// ✅ 正确：拆分为两个独立组件，各自管理自己的 state
export function KeywordInput() {
  const [keyword, setKeyword] = useState("")
  return <Input value={keyword} onChange={e => setKeyword(e.target.value)} />
}

export function CategoryInput() {
  const [category, setCategory] = useState("")
  return <Input value={category} onChange={e => setCategory(e.target.value)} />
}

export function SearchPanel() {
  return (
    <div>
      <KeywordInput />
      <CategoryInput />
    </div>
  )
}
```

### 0.4 避免 `useEffect`

`useEffect` 是逃生舱，不是常规工具。大多数场景都有更好的替代方案：

| 场景 | 替代方案 |
|------|----------|
| 获取数据 | Server Component 直接获取，或 `useAction` |
| 响应用户事件 | 事件处理函数（`onClick`、`onSubmit` 等） |
| 同步派生状态 | 直接计算派生值，不存入 state |
| 初始化第三方库 | `useRef` + 懒初始化 |
| 订阅外部数据源 | `useSyncExternalStore` |

仅在以下情况允许使用 `useEffect`：
- 订阅浏览器原生事件（`resize`、`scroll` 等）
- 与无法改造的第三方库集成
- 必须在挂载后执行的 DOM 操作

### 0.5 拆分可复用代码

相同或高度相似的代码出现超过一次，必须拆分：

- **UI 片段** → 提取为独立组件
- **逻辑片段** → 提取为独立函数放入 `lib/`
- **状态逻辑** → 提取为自定义 hook

不要因为"代码量少"而放弃拆分。重复是技术债的起点。

### 0.6 禁止内联条件渲染

内联条件渲染让代码难以阅读和维护，统一使用显式分支：

```tsx
// ❌ 禁止：内联三元
return (
  <div>
    {isLoading ? <Spinner /> : <Content />}
    {error ? <ErrorMsg /> : null}
    {data?.length ? <List data={data} /> : <Empty />}
  </div>
)

// ✅ 正确：显式分支
if (isLoading) return <Spinner />
if (error) return <ErrorMsg error={error} />
if (!data?.length) return <Empty />
return <List data={data} />
```

唯一例外：极简的单一条件渲染（如 `{isAdmin && <AdminBadge />}`），且不影响主体结构可读性时允许保留。

### 0.7 禁止嵌套 if-else，使用 Guard Clause

所有条件判断提前 return，保持函数主体逻辑在最外层、最干净的状态。

```ts
// ❌ 禁止
function processPost(post: Post | null) {
  if (post) {
    if (post.published) {
      if (post.author) {
        return doSomething(post)
      } else { return null }
    } else { return null }
  } else { return null }
}

// ✅ 正确：Guard Clause
function processPost(post: Post | null) {
  if (!post) return null
  if (!post.published) return null
  if (!post.author) return null
  return doSomething(post)
}
```

适用于组件函数、Server Action、工具函数、hook 等所有场景。

### 0.8 better-auth — 禁止绕过官方 API

如果项目使用 **better-auth**，所有与认证、用户、权限、组织相关的功能必须通过 better-auth 官方 API 实现。

| 功能域 | 必须使用 better-auth 提供的 API |
|--------|-------------------------------|
| 认证流程 | 登录、注册、登出、Session 管理 |
| 用户管理 | 用户信息读取、更新、删除 |
| 权限与角色 | Admin 判断、角色分配、权限校验 |
| 组织 | Organization CRUD、成员管理、邀请 |
| 社交登录 | OAuth 回调、账号绑定 |

**数据库结构**：better-auth 管理的表（`user`、`session`、`account`、`verification` 等）**禁止手动修改表结构**，不得添加、删除、重命名字段。如需扩展用户信息，通过 `additionalFields` 或关联表实现。migration 中禁止出现覆盖 better-auth 表结构的操作。

```ts
// ❌ 禁止：自行查询 user 表做权限判断
const user = await db.select().from(users).where(eq(users.id, userId))
if (user.role === 'admin') { ... }

// ✅ 正确
const session = await auth.api.getSession({ headers: await headers() })
if (session?.user.role === 'admin') { ... }
```

### 0.9 单一职责，控制文件长度

每个组件、函数、文件只做一件事：

- 组件只负责渲染自己对应的 UI 片段，不兼任数据获取、格式化、业务计算等职责。
- 单个文件建议不超过 **150 行**，超过时主动审视是否需要拆分。
- 判断标准：如果给这个组件/函数起名时需要用"和"连接两个概念，说明它做了两件事，应当拆分。

---

## 一、目录结构

### 整体原则

- **shadcn 生成的内容不得移动、不得修改、不得在其目录中添加非 shadcn 文件**：
  - `/components/ui/` — shadcn 组件原文件，禁止修改，禁止新增业务组件
  - `/hooks/` — shadcn 生成的 hook，禁止新增业务 hook
  - `/lib/` — shadcn 工具函数，禁止新增业务工具函数
- 业务组件 → `features/` 或 `shared/components/`
- 业务 hook → `features/[name]/hooks/` 或 `shared/hooks/`
- 业务工具函数 → `features/[name]/lib/` 或 `shared/lib/`

### 标准目录树

```
/
├── app/
│   ├── _components/
│   │   └── modal-provider.tsx      # 注册所有 Modal，在 layout 中渲染
│   ├── (auth)/
│   ├── (dashboard)/
│   └── layout.tsx                  # 引用 ModalProvider
├── components/
│   └── ui/                         # ⚠️ shadcn 自动生成，禁止修改，禁止新增
├── hooks/                          # ⚠️ shadcn 自动生成，禁止新增
├── lib/                            # ⚠️ shadcn 工具函数，禁止新增
├── features/                       # 业务功能模块
├── shared/                         # 跨功能共享资源
├── actions/                        # Server Actions
├── proxy.ts                        # 路由跳转逻辑
└── .agent/                         # Claude Code Skill 文件（勿删）
```

### `features/` 目录结构

```
features/
└── [feature-name]/
    ├── components/             # UI 组件
    ├── hooks/                  # 自定义 hook
    ├── schemas/                # Zod schema
    ├── lib/                    # 可复用工具函数
    └── index.ts                # 统一导出
```

### `shared/` 目录结构

```
shared/
├── components/                 # 通用业务组件
│   ├── root-modal.tsx
│   ├── modal-button.tsx
│   ├── alert-dialog-root.tsx
│   ├── list-empty.tsx
│   ├── spinner-empty.tsx
│   ├── data-table.tsx
│   ├── data-table-toolbar.tsx
│   ├── data-table-pagination.tsx
│   ├── data-table-column-header.tsx
│   └── data-table-faceted-filter.tsx
├── hooks/                      # 通用 hook
├── lib/                        # 跨 feature 工具函数
├── stores/
│   └── use-modal-store.ts      # 全局 Modal 状态
└── types/                      # 全局 TypeScript 类型
```

### 依赖方向规则

```
app/  →  features/  →  shared/  →  components/ui/
```

- `features/` 禁止跨 feature 直接导入。
- `shared/` 不得从 `features/` 导入任何内容。

---

## 二、shadcn 组件使用规范（强制）

> ⚠️ **在编写任何 UI 代码之前，必须先读取 `.agent/` 目录中的 shadcn skill 文件，严格按照其中的组件 API、结构和用法构建，不得凭记忆使用。**

### 2.1 必须使用 shadcn 官方组件

有对应 shadcn 组件的 UI 元素，**禁止**用 `div`、`span`、`p` 等原生元素自行实现：

| 需求 | 必须使用的 shadcn 组件 |
|------|----------------------|
| 按钮 | `Button` |
| 文字输入 | `Input` / `Textarea` |
| 表单字段 | `Form` + `FormField` + `FormItem` + `FormControl` + `FormLabel` + `FormMessage` |
| 下拉选择 | `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` |
| 弹窗 | `Dialog` 系列（通过 `RootModal`） |
| Sheet | `Sheet` 系列（通过 `RootModal` Sheet 变体） |
| 确认弹窗 | `AlertDialog` 系列（通过 `AlertDialogRoot`） |
| 卡片容器 | `Card` + `CardHeader` + `CardContent` + `CardFooter` |
| 数据表格 | `Table` 系列 / shadcn DataTable |
| 标签页 | `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` |
| 提示气泡 | `Tooltip` + `TooltipTrigger` + `TooltipContent` |
| 徽标 | `Badge` |
| 头像 | `Avatar` + `AvatarImage` + `AvatarFallback` |
| 分隔线 | `Separator` |
| 骨架屏 | `Skeleton` |
| 通知提示 | `Sonner`（`toast`） |
| 侧边栏 | `Sidebar` 系列 |
| 列表项 | `Item` + `ItemGroup` |
| 下拉菜单 | `DropdownMenu` 系列 |

### 2.2 className 使用限制

shadcn 组件样式由组件本身维护，**禁止**通过 `className` 覆盖内部样式：

```tsx
// ❌ 禁止：覆盖组件内部颜色、字体、间距、圆角等
<Button className="bg-blue-500 text-white rounded-none px-8">提交</Button>
<Input className="border-red-500 text-sm font-bold" />
<Card className="rounded-none shadow-none bg-gray-50" />

// ✅ 允许：只加影响外部布局的 className
<Button className="w-full mt-4">提交</Button>
<Input className="w-full" />
<Card className="w-full max-w-md mx-auto" />
```

**允许**的 className：`w-*`、`h-*`、`max-w-*`、`min-w-*`、`flex-*`、`col-span-*`、`mt-*`、`mb-*`、`ml-*`、`mr-*`、`mx-*`、`my-*`、`self-*`、`justify-self-*`

**禁止**的 className：`bg-*`、`text-*`（颜色）、`font-*`、`border-*`（颜色/圆角）、`rounded-*`、`shadow-*`、`p-*`、`px-*`、`py-*`、`gap-*`（内部间距）、`opacity-*`

如需修改视觉风格，使用 shadcn 提供的 `variant` 和 `size` props。

### 2.3 Radix UI vs Base UI API 差异

shadcn 底层混用 Radix UI 和 Base UI，两者 API 不同：

| 场景 | Radix UI | Base UI |
|------|----------|---------|
| 子组件作为触发元素 | `asChild` | `render` prop |

```tsx
// ✅ Radix 组件（DropdownMenuTrigger、DialogTrigger 等）
<DropdownMenuTrigger asChild>
  <Button>打开</Button>
</DropdownMenuTrigger>

// ✅ Base UI 组件
<Trigger render={<Button>打开</Button>} />

// ❌ 错误：对 Radix 组件使用 render prop
<DropdownMenuTrigger render={<Button>打开</Button>} />
```

### 2.4 DropdownMenu — Item 必须在 Group 中

`DropdownMenuItem` 必须放在 `DropdownMenuGroup` 内，分组间用 `DropdownMenuSeparator` 分隔：

```tsx
// ✅ 正确
<DropdownMenuContent>
  <DropdownMenuGroup>
    <DropdownMenuItem>编辑</DropdownMenuItem>
    <DropdownMenuItem>复制</DropdownMenuItem>
  </DropdownMenuGroup>
  <DropdownMenuSeparator />
  <DropdownMenuGroup>
    <DropdownMenuItem className="text-destructive">删除</DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>

// ❌ 错误
<DropdownMenuContent>
  <DropdownMenuItem>编辑</DropdownMenuItem>
  <DropdownMenuItem>删除</DropdownMenuItem>
</DropdownMenuContent>
```

### 2.5 Select — 已选值必须手动渲染

`SelectValue` 不会自动回显自定义内容（图标、格式化文字等），必须手动渲染：

```tsx
// ✅ 正确
const selectedOption = options.find(o => o.value === value)

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue>
      {selectedOption ? (
        <span className="flex items-center gap-2">
          <selectedOption.icon className="h-4 w-4" />
          {selectedOption.label}
        </span>
      ) : "请选择"}
    </SelectValue>
  </SelectTrigger>
  <SelectContent>
    {options.map(option => (
      <SelectItem key={option.value} value={option.value}>
        <span className="flex items-center gap-2">
          <option.icon className="h-4 w-4" />
          {option.label}
        </span>
      </SelectItem>
    ))}
  </SelectContent>
</Select>

// ❌ 错误：依赖自动回显
<SelectValue placeholder="请选择" />
```

### 2.6 其他常见注意事项

| 组件 | 注意点 |
|------|--------|
| `Tooltip` | 必须在 `TooltipProvider` 内使用，通常在根 layout 包裹一次 |
| `Command` | `CommandItem` 使用 `onSelect`，不是 `onClick` |
| `Popover` | `PopoverContent` 必须在 `PopoverTrigger` 或 `PopoverAnchor` 内使用 |
| `RadioGroup` | 通过 `value` + `onValueChange` 受控，不依赖原生 `onChange` |
| `AlertDialogAction` | 样式必须通过 `variant` prop 控制，禁止用 `className` 覆盖颜色 |

---

## 三、组件构建规范

### 3.1 组件按功能拆分文件

每个子组件对应独立文件，命名遵循 `[功能]-[类型].tsx`：

```
features/posts/components/
├── post-list.tsx
├── post-list-item.tsx
├── post-list-skeleton.tsx
├── post-card.tsx
├── post-table.tsx
├── post-table-columns.tsx
├── post-table-row-actions.tsx
├── create-post-modal.tsx
├── create-post-form.tsx
├── delete-post-alert-dialog.tsx
└── ...
```

- 单个组件文件只导出一个主组件。
- 辅助子组件仅在同文件内使用时可同文件定义，但超过 **50 行**必须拆分。

### 3.2 Modal 构建规范（Dialog / Sheet）

所有 Modal / Sheet 采用 **Zustand 全局状态 + ModalProvider 集中注册** 架构。

#### `use-modal-store.ts` — 全局状态

```ts
// shared/stores/use-modal-store.ts
import { create } from "zustand"

export type ModalType =
  | "createPost"
  | "editPost"
  | "createOrganization"
  // 每新增一个 Modal 在此注册类型

export interface ModalData {
  postId?: string
  organizationId?: string
  // 按需扩展
}

interface ModalStore {
  type: ModalType | null
  data: ModalData
  isOpen: boolean
  open: (type: ModalType, data?: ModalData) => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  open: (type, data = {}) => set({ type, data, isOpen: true }),
  close: () => set({ type: null, data: {}, isOpen: false }),
}))
```

#### `modal-provider.tsx` — 集中注册

```tsx
// app/_components/modal-provider.tsx
"use client"
import { CreatePostModal } from "@/features/posts/components/create-post-modal"
import { EditPostModal } from "@/features/posts/components/edit-post-modal"

export function ModalProvider() {
  return (
    <>
      <CreatePostModal />
      <EditPostModal />
    </>
  )
}
```

```tsx
// app/layout.tsx
import { ModalProvider } from "./_components/modal-provider"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ModalProvider />
      </body>
    </html>
  )
}
```

#### `root-modal.tsx` — 基础 UI 封装

```tsx
// shared/components/root-modal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface RootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}

export function RootModal({ open, onOpenChange, title, description, children }: RootModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

#### `xxx-modal.tsx` — 状态管理层

从 `useModalStore` 读取状态，**不接收任何 props**，**不向子组件传递任何业务回调**。业务逻辑由子组件自行处理：

```tsx
// features/posts/components/create-post-modal.tsx
"use client"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { RootModal } from "@/shared/components/root-modal"
import { CreatePostForm } from "./create-post-form"

export function CreatePostModal() {
  const { type, isOpen, close } = useModalStore()
  const open = isOpen && type === "createPost"

  return (
    <RootModal open={open} onOpenChange={close} title="创建文章">
      <CreatePostForm />
    </RootModal>
  )
}
```

编辑场景从 `data` 中读取所需数据：

```tsx
// features/posts/components/edit-post-modal.tsx
"use client"
export function EditPostModal() {
  const { type, data, isOpen, close } = useModalStore()
  const open = isOpen && type === "editPost"

  return (
    <RootModal open={open} onOpenChange={close} title="编辑文章">
      <EditPostForm postId={data.postId} />
    </RootModal>
  )
}
```

子组件（form）自行处理业务逻辑，调用 `close()` 关闭：

```tsx
// features/posts/components/create-post-form.tsx
"use client"
import { useModalStore } from "@/shared/stores/use-modal-store"

export function CreatePostForm() {
  const { close } = useModalStore()

  const { execute, isPending } = useAction(createPostAction, {
    onSuccess: () => {
      toast.success("创建成功")
      form.reset()
      close()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "操作失败")
    },
  })
  // ...
}
```

#### `ModalButton` — 触发 Modal 的统一入口

**禁止**在业务组件中直接调用 `useModalStore`，统一使用 `ModalButton`：

```tsx
// shared/components/modal-button.tsx
"use client"
import { useModalStore } from "@/shared/stores/use-modal-store"
import { Button } from "@/components/ui/button"
import type { ModalType, ModalData } from "@/shared/stores/use-modal-store"
import type { ComponentProps } from "react"

interface ModalButtonProps extends ComponentProps<typeof Button> {
  modalType: ModalType
  modalData?: ModalData
}

export function ModalButton({ modalType, modalData, children, ...props }: ModalButtonProps) {
  const { open } = useModalStore()
  return (
    <Button onClick={() => open(modalType, modalData)} {...props}>
      {children}
    </Button>
  )
}
```

```tsx
// 无数据
<ModalButton modalType="createPost">创建文章</ModalButton>

// 携带数据
<ModalButton modalType="editPost" modalData={{ postId: post.id }} variant="ghost" size="sm">
  编辑
</ModalButton>
```

#### Modal 规则汇总

- 每新增一个 Modal，必须同时在 `ModalType` 和 `ModalProvider` 中注册
- `xxx-modal` 不接收任何 props，不向子组件传递业务回调
- 触发 Modal 统一使用 `ModalButton`，禁止在业务组件中直接调用 `useModalStore`
- 业务逻辑在子组件内部处理，调用 `close()` 关闭
- Sheet 同理，替换 `RootModal` 为对应的 `RootSheet` 封装

---

## 四、表单规范（xxx-form）

### 4.1 技术栈

所有表单必须使用：

- `react-hook-form` + shadcn `Form` / `FormField` / `FormItem` / `FormControl` / `FormLabel` / `FormMessage`
- `zod` + `zodResolver` 进行 schema 校验
- `next-safe-action` + `useAction` 提交

### 4.2 Schema 文件规范

Schema 单独存放在对应 feature 的 `schemas/` 子目录，不使用根目录 `schemas/`：

```
features/
├── auth/schemas/auth.schema.ts       # createSignInSchema、createSignUpSchema 等
└── posts/schemas/post.schema.ts      # createPostSchema、updatePostSchema 等
```

跨 feature 复用的 schema 放 `shared/lib/schemas/`。

### 4.3 表单标准写法

```tsx
// features/posts/components/create-post-form.tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { createPostSchema, type CreatePostInput } from "@/features/posts/schemas/post.schema"
import { useAction } from "next-safe-action/hooks"
import { createPostAction } from "@/actions/post.actions"
import { toast } from "sonner"

export function CreatePostForm() {
  const form = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: "", content: "" },
  })

  const { execute, isPending } = useAction(createPostAction, {
    onSuccess: () => {
      toast.success("创建成功")
      form.reset()
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "操作失败，请重试")
    },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(execute)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>标题</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

### 4.4 监听字段值

**禁止** `form.watch()`，必须使用 `useWatch`：

```tsx
import { useWatch } from "react-hook-form"

// ✅ 正确
const title = useWatch({ control: form.control, name: "title" })

// ❌ 禁止
const title = form.watch("title")
```

---

## 五、Server Action 规范

### 5.1 技术要求

- 所有 Server Action 使用 `next-safe-action` 定义
- 表单提交通过 `useAction` hook 调用，不得使用原生 `action` 属性或手动 `fetch`
- 成功/失败反馈统一使用 shadcn `Sonner`（`toast`），禁止使用 `alert` 或自定义 toast

### 5.2 Action 文件规范

```ts
// actions/post.actions.ts
"use server"
import { actionClient } from "@/lib/safe-action"
import { createPostSchema } from "@/features/posts/schemas/post.schema"

export const createPostAction = actionClient
  .schema(createPostSchema)
  .action(async ({ parsedInput }) => {
    // 业务逻辑
    return { success: true }
  })
```

### 5.3 客户端数据获取 Hook

Client Component 中若需获取数据，必须封装为独立 hook，禁止在组件内内联：

```ts
// features/posts/hooks/use-posts.ts
"use client"
import { useAction } from "next-safe-action/hooks"
import { getPostsAction } from "@/actions/post.actions"

export function usePosts() {
  const { execute, result, isPending } = useAction(getPostsAction)
  return { posts: result?.data, isLoading: isPending }
}
```

---

## 六、`proxy.ts` 路由跳转规范

Next.js 16+ 使用 `proxy.ts`（项目根目录）替代 `middleware.ts`，按官方最新文档构建。

**所有路由跳转判断逻辑必须集中在 `proxy.ts` 中**，禁止在 `page.tsx`、`layout.tsx` 或组件内部散落重定向逻辑。

职责范围：
- 未登录用户访问受保护页面 → 重定向到登录页
- 已登录用户访问登录/注册页 → 重定向到主页
- 角色权限不足时的跳转

通过 `matcher` 配置精确控制作用路由范围，避免拦截静态资源。

---

## 七、逻辑复用规范

### 7.1 可复用函数必须拆分

出现超过一次或可能被复用的函数逻辑，必须抽离到对应 `lib/` 目录：

- 仅在某个 feature 内复用 → `features/[name]/lib/`
- 跨 feature 复用 → `shared/lib/`

### 7.2 Guard Clause — 禁止嵌套 if-else

见第零章 0.7 节。

---

## 八、`app/` 目录规范

### 8.1 `page.tsx` — Server Component 数据层

`page.tsx` 负责在服务端获取数据并向下传递，不包含任何 UI 结构或客户端逻辑：

```tsx
// app/(dashboard)/posts/page.tsx
import { PostsView } from "@/features/posts/components/posts-view"
import { getPosts } from "@/actions/post.actions"

export default async function PostsPage() {
  const posts = await getPosts()
  return <PostsView initialPosts={posts} />
}
```

**禁止**在 `page.tsx` 内编写 UI 结构、业务逻辑或 hook 调用。

### 8.2 客户端数据请求原则

- **优先**在 `page.tsx` Server Component 中请求数据。
- **尽量避免**在 Client Component 中发起数据请求。
- 仅在以下场景允许 Client Component 请求数据：
  - 数据依赖用户交互触发（搜索、筛选、翻页）
  - 需要实时轮询或 WebSocket
  - 数据与客户端状态强绑定，无法服务端预取
- 如确需在 Client Component 请求数据，必须封装为独立 `useXxx` hook，禁止内联。

### 8.3 `layout.tsx` 职责

只负责骨架拼接，引用布局子组件：

```tsx
// app/(dashboard)/layout.tsx
import { AppSidebar } from "@/features/navigation/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main>{children}</main>
    </SidebarProvider>
  )
}
```

---

## 九、Sidebar 构建规范

所有 Sidebar 必须基于 shadcn `Sidebar` 系列组件构建，**禁止自行实现**。

### 核心组件

| 组件 | 职责 |
|------|------|
| `SidebarProvider` | 状态容器，包裹整个 layout |
| `Sidebar` | 根容器 |
| `SidebarHeader` | 顶部区域（Logo、工作区切换） |
| `SidebarContent` | 可滚动主体区域 |
| `SidebarFooter` | 底部区域（用户信息） |
| `SidebarGroup` | 导航分组 |
| `SidebarGroupLabel` | 分组标签 |
| `SidebarMenu` | 菜单列表容器 |
| `SidebarMenuItem` | 单个菜单项 |
| `SidebarMenuButton` | 菜单项按钮（支持 `asChild` + Link） |
| `SidebarMenuSub` | 嵌套子菜单容器 |
| `SidebarMenuSubItem` | 子菜单项 |
| `SidebarMenuSubButton` | 子菜单按钮 |
| `SidebarTrigger` | 折叠/展开触发 |
| `SidebarSeparator` | 分隔线 |

### 文件拆分规范

```
features/navigation/components/
├── app-sidebar.tsx             # 组合根组件
├── sidebar-nav-main.tsx        # 主导航菜单
├── sidebar-nav-projects.tsx    # 项目/分组导航（如有）
├── sidebar-user.tsx            # 底部用户信息
└── sidebar-workspace.tsx       # 顶部工作区/Logo（如有）
```

```tsx
// features/navigation/components/app-sidebar.tsx
export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader><SidebarWorkspace /></SidebarHeader>
      <SidebarContent><SidebarNavMain /></SidebarContent>
      <SidebarSeparator />
      <SidebarFooter><SidebarUser /></SidebarFooter>
    </Sidebar>
  )
}
```

---

## 十、列表组件规范（xxx-list）

### 10.1 两种构建方式

**方式 A：`item.map` + `xxx-list-item`**

- 若 `xxx-list-item` 基于普通元素构建，外层用 `div` 包裹。
- 若 `xxx-list-item` 基于 **shadcn `Item` 组件**构建，外层**必须**用 `ItemGroup` 包裹：

```tsx
// ✅ Item 组件 → ItemGroup 包裹
import { ItemGroup } from "@/components/ui/item"

export function PostList({ posts }: { posts: Post[] }) {
  return (
    <ItemGroup>
      {posts.map(post => <PostListItem key={post.id} post={post} />)}
    </ItemGroup>
  )
}
```

**方式 B：shadcn `DataTable`**

适合需要排序、筛选、分页、搜索的结构化数据表格，严格按照 shadcn 官方 DataTable 文档构建。

文件结构：

```
features/posts/components/
├── post-table.tsx                  # DataTable 容器
├── post-table-columns.tsx          # ColumnDef 列定义
└── post-table-row-actions.tsx      # 行操作 DropdownMenu（独立文件）
```

列定义规范：

```tsx
// features/posts/components/post-table-columns.tsx
import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/shared/components/data-table-column-header"
import { PostTableRowActions } from "./post-table-row-actions"

export const columns: ColumnDef<Post>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="标题" />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="状态" />,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: "actions",
    cell: ({ row }) => <PostTableRowActions row={row} />,
  },
]
```

行操作（`DropdownMenu` 必须按 2.4 节规范使用 `DropdownMenuGroup`）：

```tsx
// features/posts/components/post-table-row-actions.tsx
export function PostTableRowActions<TData>({ row }: { row: Row<TData> }) {
  const post = row.original as Post
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => open("editPost", { postId: post.id })}>编辑</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => handleDelete(post.id)} className="text-destructive">删除</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

表格容器按需启用官方插件：

| 功能 | 实现方式 |
|------|----------|
| 排序 | `getSortedRowModel()` + `DataTableColumnHeader` |
| 全局搜索 | `globalFilter` state + `Input`，放在 Toolbar 中 |
| 列筛选 | `getFilteredRowModel()` + `DataTableFacetedFilter` |
| 分页 | `getPaginationRowModel()` + `DataTablePagination` |
| 列显示控制 | `VisibilityState` + `DataTableViewOptions` |

`DataTableColumnHeader`、`DataTableToolbar`、`DataTablePagination`、`DataTableFacetedFilter`、`DataTableViewOptions` 直接从 shadcn 官方文档复制，放在 `shared/components/`，不得自行实现。

### 10.2 列表状态管理：显式分支渲染

**禁止**内联三元，必须使用显式 `if` 分支：

```tsx
// ❌ 禁止
return isPending ? <Skeleton /> : <PostList posts={posts} />

// ✅ 正确
if (isPending) return <PostListSkeleton />

if (!posts.length) {
  return (
    <ListEmpty icon={FileIcon} title="暂无内容" description="还没有任何文章">
      <ModalButton modalType="createPost">创建文章</ModalButton>
    </ListEmpty>
  )
}

return <PostList posts={posts} />
```

### 10.3 全局 `ListEmpty` 组件

```tsx
// shared/components/list-empty.tsx
interface ListEmptyProps {
  icon?: LucideIcon
  title: string
  description?: string
  children?: ReactNode    // 操作按钮区域
}
```

### 10.4 列表 Skeleton

每个列表配套 `xxx-list-skeleton.tsx`，使用 shadcn `Skeleton` 模拟真实布局：

```
features/posts/components/
├── post-list.tsx
├── post-list-item.tsx
└── post-list-skeleton.tsx
```

---

## 十一、非列表组件加载状态规范

Modal 内容、表单区域、详情面板等非列表组件加载时，使用以下方式之一：

**方式 A：局部 Skeleton** — 精确模拟内容区域结构。

**方式 B：全局 `SpinnerEmpty`** — 用于无法精确模拟布局的场景：

```tsx
// shared/components/spinner-empty.tsx
export function SpinnerEmpty({ title = "加载中..." }: { title?: string }) {
  // icon 为旋转 spinner，基于 shadcn Empty 构建
}

// 使用
if (isPending) return <SpinnerEmpty />
```

---

## 十二、确认操作规范（AlertDialog）

凡是不可逆操作（删除、退出登录、清空数据等）必须弹出确认 dialog。

AlertDialog **不使用全局 store**，由父组件本地 `useState` 管理 `open` 状态，与 Modal 架构完全分离。

### `alert-dialog-root.tsx` — 基础 UI 封装

```tsx
// shared/components/alert-dialog-root.tsx
interface AlertDialogRootProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  isPending?: boolean
  onConfirm: () => void
  variant?: "destructive" | "default" | "outline"
}

export function AlertDialogRoot({
  open, onOpenChange, title, description,
  confirmLabel = "确认", cancelLabel = "取消",
  isPending, onConfirm, variant = "destructive",
}: AlertDialogRootProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant="outline">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending} variant={variant}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### `xxx-alert-dialog.tsx` — 业务逻辑层

只接收 `open`、`onOpenChange` 和业务数据 props，**自行处理所有业务逻辑**，不向外暴露任何业务回调：

```tsx
// features/posts/components/delete-post-alert-dialog.tsx
interface DeletePostAlertDialogProps {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePostAlertDialog({ postId, open, onOpenChange }: DeletePostAlertDialogProps) {
  const { execute, isPending } = useAction(deletePostAction, {
    onSuccess: () => { toast.success("删除成功"); onOpenChange(false) },
    onError: ({ error }) => { toast.error(error.serverError ?? "删除失败") },
  })

  return (
    <AlertDialogRoot
      open={open}
      onOpenChange={onOpenChange}
      title="确认删除？"
      description="此操作不可撤销，删除后数据将永久丢失。"
      confirmLabel="确认删除"
      isPending={isPending}
      onConfirm={() => execute({ id: postId })}
      variant="destructive"
    />
  )
}
```

### 在父组件中使用

父组件用 `useState` 管理 `open`，用 Fragment 并列渲染：

```tsx
// features/posts/components/post-list-item.tsx
"use client"
export function PostListItem({ post }: { post: Post }) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <Item>
        <span>{post.title}</span>
        <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </Item>

      <DeletePostAlertDialog
        postId={post.id}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
```

### AlertDialog 规则汇总

- 不注册到 `ModalProvider`，不使用 `useModalStore`
- `xxx-alert-dialog` 只接收 `open`、`onOpenChange` 和数据 props，不接收业务回调
- `open` 状态由父组件本地 `useState` 管理，Fragment 并列渲染
- `AlertDialogAction` 样式必须通过 `variant` prop 控制，禁止用 `className` 覆盖
- 禁止使用浏览器原生 `confirm()`
- size 统一 `max-w-sm`（在 `AlertDialogRoot` 中统一维护）

---

## 十三、编码前置检查清单

在开始实现任何功能前，依次确认：

- [ ] 已读取 `.agent/` 中的 shadcn skill 文件
- [ ] 新建组件放在正确的 `features/` 或 `shared/` 目录
- [ ] 未在 `/components/ui/`、`/hooks/`、`/lib/` 中新增或修改任何文件
- [ ] 没有跨 feature 直接导入
- [ ] 组件能用 Server Component 的未加 `"use client"`
- [ ] 单个组件 `useState` 不超过 2 个，多个 state 已拆分子组件
- [ ] 未使用不必要的 `useEffect`
- [ ] 所有函数使用 Guard Clause，无嵌套 if-else
- [ ] 无内联条件渲染（除极简单一条件外）
- [ ] 可复用函数已拆分到对应 `lib/` 目录
- [ ] 单个文件不超过 150 行
- [ ] shadcn 组件未用 `className` 覆盖内部样式，视觉变体通过 `variant`/`size` 控制
- [ ] 有对应 shadcn 组件的 UI 未用原生元素自行实现
- [ ] Zod schema 放在对应 feature 的 `schemas/` 子目录
- [ ] 表单使用 `react-hook-form` + shadcn Form 系列 + `zod` + `useAction`
- [ ] 表单监听字段值使用 `useWatch`，未使用 `form.watch()`
- [ ] 成功/失败反馈使用 `Sonner`（`toast`）
- [ ] 新增 Modal 已在 `ModalType` 和 `ModalProvider` 中注册
- [ ] `xxx-modal` 不接收 props，不向子组件传递业务回调
- [ ] 触发 Modal 使用 `ModalButton`，未在业务组件中直接调用 `useModalStore`
- [ ] AlertDialog 由父组件本地 `useState` 管理，Fragment 并列渲染，未注册到 ModalProvider
- [ ] `xxx-alert-dialog` 不接收业务回调，`AlertDialogAction` 通过 `variant` 控制样式
- [ ] 数据请求优先在 `page.tsx` Server Component 中完成
- [ ] Client Component 数据请求已封装为独立 `useXxx` hook
- [ ] 路由跳转判断逻辑集中在 `proxy.ts`
- [ ] `page.tsx` 无 UI 逻辑，`layout.tsx` 无业务逻辑
- [ ] Sidebar 使用 shadcn Sidebar 系列并按职责拆分文件
- [ ] 列表状态使用显式 `if` 分支，有配套 skeleton 和 `ListEmpty`
- [ ] 非列表加载状态使用局部 skeleton 或 `SpinnerEmpty`
- [ ] DataTable 已拆分 `columns.tsx` 和 `row-actions.tsx`，功能按官方插件实现
- [ ] `DropdownMenuItem` 在 `DropdownMenuGroup` 中
- [ ] `Select` 已选值已手动渲染
- [ ] better-auth 相关功能使用官方 API，未手动修改 better-auth 数据库表结构

---

> 如有与本指南冲突的需求，优先遵循本指南，并在动手前提出疑问。
