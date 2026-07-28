# 知途 · 校招简历助手

面向应届生和实习生的简历构建、岗位匹配与求职辅助网站。当前版本使用
React、TypeScript、vinext 和 Supabase，支持邮箱密码登录、用户数据隔离、
云端自动保存、真实历史版本、简历导入、本地 JD 规则匹配，以及 A4 PDF/PNG
导出。

项目坚持事实安全原则：不会虚构经历、项目、技能、数字或时间；所有建议只
用于润色、结构调整和关键词强化。

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
```

创建 `.env.local` 并填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

构建生产版本：

```bash
npm run build
```

## 核心能力

- 邮箱和密码注册登录
- Supabase 云端工作区与用户数据隔离
- 多份简历、多条经历、历史版本恢复
- PDF、DOCX、TXT、JPG、PNG 简历导入
- A4 实时预览、智能一页、PDF/PNG 导出
- 本地规则驱动的 JD 关键词匹配与面试问题
- 不连接任何 AI API

## 主要目录

- `app/`：页面、交互、简历数据结构和 Supabase 客户端
- `public/assets/`：兼容已发布版本的静态资源
- `supabase/`：数据库表结构和 RLS 策略
- `worker/`：正式环境 Worker 入口
- `.openai/hosting.json`：现有 Sites 项目标识

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: build the production site
- `npm test`: run the production build check
- `npm run lint`: run ESLint
