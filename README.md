# Streaming Chatbot

> 基于 Next.js 16 + Vercel AI SDK 6 构建的全功能 AI 流式聊天应用

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-336791?logo=postgresql)

---

## 功能特性

### AI 对话
- **流式响应** — 基于 Vercel AI SDK 6，使用 OpenAI（或任意兼容接口）实时流式输出
- **自动生成标题** — 首次对话完成后，调用 LLM 自动为会话命名
- **自定义系统提示词** — 每个会话可单独设置 System Prompt，灵活控制 AI 行为
- **停止生成** — 流式输出过程中可随时停止

### 多会话管理
- **创建 / 删除 / 重命名** 会话
- **搜索** 历史会话（`Ctrl+K` 快速聚焦搜索框）
- **置顶** 重要会话
- **按日期分组** 展示会话列表（今天、昨天、最近 7 天……）

### 消息操作
- **复制** 消息内容到剪贴板
- **删除** 消息（含确认弹出框，5 秒超时自动取消）
- **重新生成** 回复（刷新，含确认弹出框）
- **编辑** 用户消息并重新发送

### 分享与导出
- **分享链接** — 生成唯一分享 ID，只读视图供任何人访问
- **导出聊天** — 支持导出为 Markdown（`.md`）或 JSON（`.json`）格式

### 界面与体验
- **深色 / 浅色主题** 切换
- **Markdown 渲染** — 完整 GFM 支持，代码块语法高亮
- **键盘快捷键** — 常用操作均可通过键盘完成
- **移动端响应式** — 侧边栏在移动端可收起
- **无障碍访问** — Skip-to-content 链接、ARIA 属性

---

## 技术栈

| 类别 | 技术 |
|---|---|
| 框架 | Next.js 16（App Router、Turbopack） |
| UI 库 | React 19、TypeScript 5 |
| AI SDK | Vercel AI SDK 6（`ai`、`@ai-sdk/openai`、`@ai-sdk/react`） |
| 数据库 | PostgreSQL + Drizzle ORM |
| 样式 | Tailwind CSS 4、`@tailwindcss/typography` |
| Markdown | `react-markdown`、`remark-gfm`、`react-syntax-highlighter` |
| 图标 | `lucide-react` |
| 字体 | Geist Sans / Geist Mono |

---

## 前置条件

- **Node.js** 18+
- **PostgreSQL** 数据库（本地或云端均可）
- **OpenAI API Key**（或任意兼容 OpenAI 协议的接口）

---

## 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd streaming-chatbot
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制示例文件并填写配置：

```bash
cp .env.local.example .env.local
```

打开 `.env.local`，根据下表填写对应值：

| 变量 | 必填 | 说明 | 默认值 |
|---|---|---|---|
| `OPENAI_API_KEY` | 是 | OpenAI API Key，从 [platform.openai.com](https://platform.openai.com/api-keys) 获取 | — |
| `OPENAI_API_BASE_URL` | 否 | 自定义 API Base URL，用于代理、Azure OpenAI 或其他兼容接口 | 官方 OpenAI |
| `OPENAI_MODEL` | 否 | 使用的模型名称（如 `gpt-4o`、`gpt-4-turbo`） | `gpt-4o-mini` |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串，格式：`postgresql://USER:PASSWORD@HOST:PORT/DATABASE` | — |

**示例 `.env.local`：**

```env
OPENAI_API_KEY=sk-...your-key-here...
OPENAI_API_BASE_URL=
OPENAI_MODEL=
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chatbot
```

### 4. 初始化数据库

运行数据库迁移，创建所需表结构：

```bash
npm run db:migrate
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)。

---

## 可用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（Turbopack） |
| `npm run build` | 构建生产版本 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | 运行 ESLint 代码检查 |
| `npm run db:generate` | 根据 schema 生成 Drizzle 迁移文件 |
| `npm run db:migrate` | 执行数据库迁移 |
| `npm run db:studio` | 打开 Drizzle Studio 可视化数据库管理界面 |
| `npm run db:check` | 检查迁移文件一致性 |

---

## 项目结构

```
streaming-chatbot/
├── drizzle/                    # 数据库迁移 SQL 文件
├── public/                     # 静态资源
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/
│   │   │       ├── route.ts            # POST /api/chat — 流式对话接口
│   │   │       └── [chatId]/
│   │   │           ├── title/route.ts  # POST — 自动生成会话标题
│   │   │           └── export/route.ts # GET  — 导出聊天（Markdown/JSON）
│   │   ├── chat/
│   │   │   └── [chatId]/
│   │   │       └── page.tsx            # 单个会话页面
│   │   ├── share/
│   │   │   └── [shareId]/
│   │   │       └── page.tsx            # 分享链接只读视图
│   │   ├── actions.ts                  # Next.js Server Actions
│   │   ├── layout.tsx                  # 根布局（侧边栏 + 主内容区）
│   │   └── page.tsx                    # 首页（自动重定向至最新会话）
│   ├── components/
│   │   ├── ChatInterface.tsx           # 核心聊天界面（消息列表 + 输入框）
│   │   ├── MessageList.tsx             # 消息列表（含操作按钮）
│   │   ├── MessageInput.tsx            # 消息输入框
│   │   ├── Sidebar.tsx                 # 侧边栏（Server Component）
│   │   ├── SidebarClient.tsx           # 侧边栏（Client Component）
│   │   ├── SidebarProvider.tsx         # 侧边栏展开/收起状态
│   │   ├── ShareButton.tsx             # 分享按钮
│   │   ├── SystemPromptButton.tsx      # 系统提示词入口
│   │   ├── SystemPromptModal.tsx       # 系统提示词编辑弹窗
│   │   ├── CodeBlock.tsx               # 代码块（语法高亮）
│   │   ├── ThemeProvider.tsx           # 主题 Provider
│   │   ├── ThemeToggle.tsx             # 深色/浅色切换按钮
│   │   ├── MobileSidebarToggle.tsx     # 移动端侧边栏切换
│   │   └── ExportDropdown.tsx          # 导出下拉菜单（点击外部自动关闭）
│   ├── constants/
│   │   └── index.ts                    # 全局常量
│   └── lib/
│       ├── db/
│       │   ├── schema.ts               # Drizzle 数据库 Schema
│       │   ├── queries.ts              # 数据库查询函数
│       │   └── index.ts                # 数据库连接
│       └── getTextContent.ts           # 从 UIMessage 提取纯文本
├── drizzle.config.ts                   # Drizzle Kit 配置
├── next.config.ts                      # Next.js 配置
└── .env.local.example                  # 环境变量示例
```

---

## 键盘快捷键

| 快捷键 | 说明 |
|---|---|
| `Ctrl+K` / `Cmd+K` | 聚焦侧边栏搜索框 |
| `Ctrl+N` / `Cmd+N` | 新建会话 |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | 展开 / 收起侧边栏 |
| `?` | 显示 / 隐藏快捷键帮助面板 |
| `Esc` | 关闭快捷键帮助面板 |
| `Enter` | 发送消息 |
| `Shift+Enter` | 消息输入框内换行 |
| `↑`（输入框为空时） | 编辑最后一条用户消息 |

---

## 数据库 Schema

应用使用两张核心数据表：

- **`chats`** — 会话记录，包含标题、置顶状态、系统提示词、分享 ID 等字段
- **`messages`** — 消息记录，关联会话，支持 `user` / `assistant` / `system` 角色

---

## License

本项目暂未指定开源协议。
