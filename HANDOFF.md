# 知途 · 校招简历助手项目交接文档

> 写给完全没有上下文的新 Codex 会话。请先完整阅读本文件，再开始修改项目。

## 1. 项目是什么

项目名称：**知途 · 校招简历助手**

这是一个面向应届生和实习生的简历求职辅助网站，核心流程包括：

1. 邮箱与密码注册、登录；
2. 创建、导入和编辑简历；
3. A4 实时预览；
4. 多条教育、实习、项目、校园经历编辑；
5. 模块排序、隐藏、自定义模块；
6. 历史版本与云端保存；
7. 本地 JD 关键词匹配和面试问题；
8. PDF、PNG 导出。

技术栈以 React / TypeScript / Next.js 前端为主，Supabase 用于账号与云端数据。项目不接入 AI API，JD 分析采用本地规则。

## 2. 唯一正确的项目位置

真正项目已经迁移到：

`E:\Codex\2026-07-28\ux-mvp-1-2-3-4`

旧位置：

`C:\Users\lenovo\Documents\Codex\2026-07-28\ux-mvp-1-2-3-4`

不是当前项目。不要在那里继续开发、提交或部署。

本交接文件暂时生成在：

`C:\Users\lenovo\Documents\Codex\HANDOFF.md`

原因是当前旧会话仍绑定迁移前的 C 盘工作区，权限无法直接写入 E 盘。新会话从 E 盘项目打开后，应把本文件复制到：

`E:\Codex\2026-07-28\ux-mvp-1-2-3-4\HANDOFF.md`

## 3. 线上、GitHub 与部署信息

- 正式网站：`https://zhitu-campus-career.m72554083.chatgpt.site`
- GitHub 仓库：`https://github.com/maoma12/zhitu-campus-career`
- Sites project ID：`appgprj_6a685d18afb48191a1ee93a553c72bda`
- 最近已知线上版本：V20
- 最近已知 GitHub 提交：
  - `aa7c55fc9dc809563154ebeb5e7ee10ba50f4580`
  - `506abfb643fc8df35500fdd5e8368e711b6757da`
- 最近已知 Sites 源提交：
  - `609e4c8a7a084f5a5929d8263f87947b22f14ed0`

项目内存在 `.openai/hosting.json`，因此发布时必须复用现有 Sites 项目，绝对不要新建另一个 Sites 项目。

## 4. 已经完成的功能

### 账号和数据

- Supabase 邮箱与密码注册登录；
- 用户数据隔离；
- 云端自动保存；
- 历史版本保存与恢复；
- 保留旧版本数据兼容逻辑，例如 `normalizeResume`；
- 不清空、不重建现有 Supabase 用户简历数据。

### 简历中心和编辑器

- 简历创建、删除、复制、改名；
- 多条教育、实习、项目、校园经历；
- 模块顺序调整、隐藏与显示；
- 自定义模块名称与自定义模块；
- 头像上传与预览；
- 输入换行在预览中保留；
- 实时 A4 简历预览；
- 模板切换；
- 自动分页基础能力；
- 内容减少后删除多余空白页的逻辑曾经处理过；
- 编辑内容加粗按钮已有基础实现。

### 导入和导出

- PDF、DOCX、TXT 文字导入解析；
- JPG、PNG 浏览器本地 OCR/文字解析；
- PDF 导出；
- PNG 导出；
- DOCX 导出入口已按用户要求删除，禁止恢复；
- 曾修复过打印整个应用导致 PDF 重复页的问题，打印必须只针对 `#resume-print-root`。

### JD 匹配

- 本地规则关键词匹配；
- 岗位评分、缺失项和面试问题；
- 不调用任何 AI API。

### 已明确的产品边界

- AI 只能优化已有事实，不能编造经历、项目、技能、时间或数据；
- 当前版本彻底不接 AI API；
- 不恢复 OpenAI、DeepSeek 或其他 AI 接口；
- 不恢复 DOCX 导出；
- 不增加复杂后台；
- 不清空 Supabase 数据。

## 5. 当前正在处理、尚未完成的问题

用户最新要求修复以下三项，**当前还没有完成代码修改，也没有提交或部署**：

### 问题 1：简历模块标题没有加粗

右侧简历预览中的模块标题，例如“校园经历”“技能特长”等，需要明确加粗。

已定位 CSS：

`app/globals.css`

当前 `.paper-section h2` 没有显式设置 `font-weight`，类似：

```css
.paper-section h2 {
  margin: 0 0 7px;
  border-bottom: 1px solid #1e2722;
  padding-bottom: 4px;
  font-size: 10px;
  letter-spacing: 0.04em;
}
```

建议增加：

```css
font-weight: 800;
```

并检查智能一页、超紧凑模式及所有模板没有覆盖回正常字重。

### 问题 2：智能一页逻辑错误

用户期望：

- 内容自然不超过一页时，保持正常字号、行距和页边距；
- 只有内容略微超过一页时，才自动压缩到一页；
- 不能一开启“智能一页”就缩小；
- 不能因为过度缩小导致页面下方出现大片留白；
- 内容很多、压缩后仍放不下一页时，应正常分页，而不是无限缩小。

当前根因：

`app/page.tsx` 中 `ResumePreview` 只要 `smartOnePage === true` 就直接添加：

```tsx
smart-one-page
```

而 `.smart-one-page` CSS 已经缩小页边距、字号和行距，所以即使内容本来一页能放下，也会被压缩。

当前相关状态大约在 `app/page.tsx` 2662 附近：

```tsx
const [smartOnePage, setSmartOnePage] = useState(true);
const [fitsOnePage, setFitsOnePage] = useState(true);
const [compactLayout, setCompactLayout] = useState(false);
const [pageCount, setPageCount] = useState(1);
```

建议重构为明确的密度状态机：

```ts
type ResumeDensity = "normal" | "compact" | "ultra";
```

推荐流程：

1. 始终先用 `normal` 测量；
2. 如果智能一页已开启，并且 normal 超出一页，再切换 `compact`；
3. compact 仍略超出，再切换 `ultra`；
4. ultra 仍放不下，则按可读密度正常分页；
5. 内容减少时必须重新从 normal 测量，自动恢复字号并删除多余页面；
6. 防止 measurement effect 在 normal/compact 之间反复振荡。

“智能一页是否启用”和“当前实际是否压缩”必须是两个不同概念。

### 问题 3：过页排版异常

用户截图显示：

- 第一页底部出现异常大块空白；
- 第二页从不合理的位置开始；
- “课程助教”等短中文标题被拉成“课 程 助 教”；
- 预览分页和实际导出页数可能不一致。

已知根因和风险：

1. 分页测量循环在读取后续元素 `offsetTop` 的同时，修改前面元素的 `marginTop`，导致后续坐标级联变化；
2. 一个完整 `PaperEntry` 被当作单个分页块，条目较长时无法合理拆分；
3. 以下 CSS 对短中文强制换行内容使用两端对齐：

```css
.paper-entry p,
.paper-section > p {
  text-align: justify;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

这会把短中文行拉开。建议改为：

```css
text-align: left;
```

并保留：

```css
white-space: pre-wrap;
```

4. `.paper-page-break` 是预览中的绝对定位视觉线，打印时隐藏；如果预览内容高度和打印内容高度计算不同，会出现预览与 PDF 不一致。

建议分页重构：

- 第一阶段只读取所有元素的自然位置和高度，不修改样式；
- 计算每个分页点；
- 第二阶段一次性应用分页间距；
- 应用后重新测量并校验一次；
- 模块标题与第一条经历尽量保持在同一页；
- 条目标题、日期和第一段内容不能拆开；
- 很长的正文允许自然跨页，不要为了保持整块而留下半页空白；
- 页面底部和下一页顶部保留一致、美观的安全留白；
- 内容减少后重新计算 `pageCount`，直接删除末尾空白页。

## 6. PDF 检查结果

用户提供：

- PDF：`C:\Users\lenovo\Desktop\11.pdf`
- 截图：`C:\Users\lenovo\AppData\Local\Temp\codex-clipboard-cc2c3b48-c11d-4d69-931d-a11c7f3c4a57.png`

已用 Poppler 检查：

- PDF 实际只有 1 个物理页面；
- 页面尺寸约 594.96 × 841.92 pt，为 A4；
- 文件由浏览器 Skia PDF 生成；
- 文件大小约 563748 bytes。

渲染结果曾生成到：

`%TEMP%\zhitu-11-render\page-1.png`

重要结论：截图中的预览视觉上像两页或包含分页断层，但导出的 PDF 实际是一页。这说明预览分页与打印分页存在不一致风险。后续必须同时验证浏览器预览和真正导出的 PDF，不能只看其中一个。

## 7. 推荐的下一步执行顺序

新会话请按以下顺序执行：

1. 从 `E:\Codex\2026-07-28\ux-mvp-1-2-3-4` 打开项目；
2. 确认当前工作目录确实是 E 盘；
3. 完整阅读本 HANDOFF；
4. 检查 `git status`，保留用户已有修改；
5. 读取 `.openai/hosting.json`，确认复用现有 Sites project ID；
6. 修复 `.paper-section h2` 字重；
7. 将智能一页重构为 normal / compact / ultra 密度状态机；
8. 分阶段重构分页测量，避免边测量边修改；
9. 修复中文段落两端对齐导致的字符分散；
10. 执行项目构建和类型检查；
11. 本地打开网页测试：
    - 一页以内不缩小；
    - 略超一页能压缩到一页；
    - 大量内容正常分页；
    - 减少内容后空白页消失；
    - 标题保持加粗；
    - 中文不被异常拉开；
12. 导出 PDF，使用 Poppler 渲染为 PNG，与网页预览逐页对比；
13. 先把测试网站或本地结果交给用户检查；
14. 只有用户明确说“通过，更新 GitHub 和线上”后，才提交、推送和部署。

## 8. 绝对不要再踩的坑

### 文件和路径

- 不要在旧 C 盘空目录修改项目；
- 不要误删 E 盘项目；
- 不要把当前迁移前会话的工作目录当成真正项目；
- 不要覆盖用户未提交的本地修改；
- 不要使用破坏性 Git 命令，例如 `git reset --hard`。

### 智能一页与分页

- 不要让“智能一页开关”直接等于“压缩样式已启用”；
- 不要无限缩小字号和页边距；
- 不要在读取后续元素坐标时同时改变前面元素的 margin；
- 不要为了不拆整个长条目而留下大半页空白；
- 不要把预览分页辅助线计入正文高度；
- 不要只验证网页预览，不验证真正导出的 PDF；
- 不要对短中文强制换行文本使用 `text-align: justify`。

### 导出

- PDF 打印只能输出 `#resume-print-root`；
- 不要打印整个应用，否则可能再次出现重复两页；
- PDF 与 PNG 必须尽量和预览一致；
- 不要恢复 DOCX 导出。

### 产品和数据

- 不要恢复任何 AI API；
- 不要加入 DeepSeek、OpenAI 或其他模型密钥；
- 不要清空 Supabase 数据；
- 不要修改真实经历、技能、时间或事实；
- 不要添加用户没有提供的经历或量化数据。

### 部署和缓存

- 不要创建新的 Sites 项目；
- 必须复用 `.openai/hosting.json` 中的 project ID；
- 不要随意删除 `public/assets` 下的旧哈希静态资源，旧缓存 HTML 可能仍请求旧文件，曾经因此出现线上白屏；
- Sites 的归档必须包含：
  - `dist/server/index.js`
  - `dist/.openai/hosting.json`
- Windows 上 Sites 推送如遇 Git SSL 问题，可临时使用：
  - `-c http.sslBackend=openssl`
- 不要把 GitHub token 或任何密钥写入仓库、配置文件或 Git remote。

## 9. GitHub 与上线规则

当前三个最新问题尚未修改，因此也没有新的 GitHub 提交和线上版本。

用户已明确采用以下流程：

1. 本地修改；
2. 构建验证；
3. 提供网站或本地结果给用户测试；
4. 用户明确确认通过；
5. 才更新 GitHub；
6. 才发布现有 Sites 项目。

没有用户明确批准时，不要擅自推送或部署。

## 10. 新会话首次回复建议

可简短回复：

> 我已完整阅读 HANDOFF.md，并确认真正项目位于 `E:\Codex\2026-07-28\ux-mvp-1-2-3-4`。我会先修复模块标题加粗、智能一页仅在溢出时压缩、跨页排版三个问题，完成构建与 PDF 对比测试后先交给你检查，不会提前更新 GitHub 或线上。

