# 英语口语顶呱呱（spea / speak-coach）

一个基于 Node.js + WebSocket + React 的 AI 英语口语陪练工具。在「面试 / 点餐 / 会议 / 雅思口语」等场景里跟 AI 对话，获得发音评测、语法纠正与课后报告。

> - 在线体验：<https://spea.xiaoyangxiaozhang.xyz>
> - 演示视频：<https://www.bilibili.com/video/BV1LUE86oE7b/?vd_source=ea4f9691ba92f806edac69ffc8270565>

---

## 功能一览

- 🎤 **实时对话**：浏览器 SpeechRecognition + VAD 静默自动停止；录音预览**逐词增量追加**（无前缀闪烁）；可选服务端 SenseVoice 转写，自动补标点与句首大写
- 🗣️ **TTS 朗读**：讯飞在线 TTS（默认）+ 浏览器原生 TTS 兜底，支持 5 档语速调节
- 🔊 **AI 消息朗读**：对话页每条 AI 回复可单独重播
- ✍️ **智能纠错**：对话中不打断，课后集中展示语法错误与表达升级
- 📊 **发音评测**：前端并行采集 16kHz PCM → 讯飞 ISE 声学评测（准确度 / 流利度 / 完整度 / 逐词分）
- 📝 **课后报告**：LLM 生成总览 + 五维雷达图 + 纠错 + 隐性重述 + 成长曲线 + 对话回顾
- 📥 **报告导出**：一键将报告正文截图为 PNG 下载
- 📖 **生词本**：对话中点词查义、收藏，支持 TTS 跟读复习
- 🌱 **成长系统**：连击 / 等级 / 20 个成就（哈密瓜主题），每日打卡热力图
- 👥 **瓜友 & 直播间**：登录后系统按 CEFR 水平匹配搭子，邀请成为瓜友后可发贴纸、双排练习（冷启动可 `npm run seed:buddies -w server` 写入示例用户）
- 📱 **PWA**：可安装、离线缓存

### 预设场景（9 个）

| 场景 | 难度 | 分类 |
|------|------|------|
| Job Interview | 中级 | 职场 |
| Team Meeting | 高级 | 职场 |
| Presentation Q&A | 高级 | 职场 |
| Restaurant Ordering | 初级 | 生活 |
| Doctor Visit | 中级 | 生活 |
| Shopping | 初级 | 生活 |
| Hotel Check-in | 初级 | 出行 |
| Small Talk | 初级 | 社交 |
| IELTS Speaking | 高级 | 考试 |

另支持**自由话题**自定义场景。

---

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vite 5 + React 18 + TypeScript + Tailwind 3 + Zustand + React Router 6 |
| 图表 | Recharts |
| 报告导出 | html2canvas |
| 音频 | Web Audio API + AudioWorklet + `@ricky0123/vad-web` |
| 后端 | Node 20 + Express + ws + Prisma + SQLite |
| LLM | OpenAI 兼容协议（默认 deepseek-v3） |
| 语音 | 讯飞 TTS / ISE，SiliconFlow SenseVoice ASR，浏览器 Speech API |
| 部署 | Docker Compose + Nginx + Let's Encrypt |

---

## 目录结构

```
spea/
├── web/                    # 前端（Vite + React 18 + TS）
│   ├── src/
│   │   ├── audio/          # 录音 / TTS / VAD / PCM 采集 / 讯飞客户端
│   │   ├── hooks/          # useVoiceInput / useConversationLlm 等
│   │   ├── pages/          # Home / ScenarioHub / Conversation / Report …
│   │   ├── store/          # Zustand：session / settings / auth / buddy / vocab
│   │   ├── llm/            # 报告与提示生成
│   │   ├── api/            # HTTP：发音评测 / ASR / 账号
│   │   └── lib/            # 工具（含 export-report-png）
├── server/                 # 后端（Express + ws + Prisma）
│   ├── src/
│   │   ├── gateway/        # WebSocket 网关（对话 / TTS / ASR）
│   │   ├── http/           # REST：账号 / 数据 / 发音评测 / ASR / 瓜友
│   │   ├── modules/        # dialog / correction / report / asr / tts / pronunciation
│   │   └── lib/            # llm-client / 讯飞鉴权
│   └── prisma/             # schema + migrations
├── shared/                 # 前后端共享类型与契约（@speak-coach/shared）
│   ├── contracts.ts        # WebSocket / HTTP 契约
│   └── transcript-normalize.ts  # 转写标点与句首大写规范化
├── specs/                  # 产品 / 设计 / TDD / 任务文档
├── openspec/               # OpenSpec 变更与规格
├── docker-compose.yml
└── DEPLOY.md               # 服务器部署手册
```

---

## 快速开始

### 1. 环境要求

- Node.js 20+
- npm 10+

### 2. 安装依赖

```bash
npm install
```

工作区会同时安装 `web` / `server` / `shared` 三个子包。

### 3. 配置环境变量

复制根目录 `.env.example` 为 `.env`，至少填入 LLM 密钥：

```bash
cp .env.example .env
```

| 变量 | 说明 | 必需 |
|------|------|------|
| `OPENAI_API_KEY` | LLM API Key | ✅ |
| `OPENAI_BASE_URL` | LLM 代理地址（如 `https://api.qnaigc.com/v1`） | 推荐 |
| `LLM_MODEL` | 模型名（默认 `deepseek-v3`） | 可选 |
| `XFYUN_APP_ID/KEY/SECRET` | 讯飞 TTS + 发音评测 | 推荐 |
| `SILICONFLOW_API_KEY` | SenseVoice 服务端 ASR | 推荐 |
| `JWT_SECRET` | 账号 JWT 签名（生产务必改） | 生产必需 |
| `DATABASE_URL` | SQLite 路径（默认 `file:./dev.db`） | 可选 |

前端开发变量见 `web/.env.example`（`VITE_SERVER_URL`、`VITE_API_BASE_URL` 等）。

### 4. 初始化数据库

```bash
npm run db:migrate -w server
npm run seed:buddies -w server   # 可选：写入示例瓜友（冷启动匹配）
```

### 5. 启动开发

```bash
# 前后端同时启动（server :3001 WS + :3002 HTTP，web :5173）
npm run dev
```

或分别启动：

```bash
npm run dev:server   # 后端
npm run dev:web      # 前端 → http://localhost:5173
```

### 6. 运行测试

```bash
npm test                  # 全部
npm test -w web           # 仅前端
npm test -w server        # 仅后端
npm run lint              # 类型检查
npm run test:coverage     # 覆盖率
```

---

## 页面路由

| 路径 | 页面 |
|------|------|
| `/` | 主页（每日目标 + 快捷入口） |
| `/practice` | 场景选择 |
| `/conversation` | 实时对话 |
| `/report` | 课后报告 |
| `/progress` | 成长曲线与历史 |
| `/vocab` | 生词本 |
| `/achievements` | 成就墙 |
| `/buddies` | 瓜友 |
| `/room/:id` | 共练直播间 |
| `/profile` | 个人设置 |
| `/login` | 登录 / 注册 |

---

## 架构概览

```
浏览器                         后端
┌─────────────────┐           ┌──────────────────────────┐
│ SpeechRecognition│           │ HTTP :3002               │
│ + PCM Recorder   │──POST───▶│ /pronunciation/assess    │──▶ 讯飞 ISE
│ + SenseVoice ASR │──POST───▶│ /asr                     │──▶ SiliconFlow
│                  │           │ /auth /data /buddy       │──▶ SQLite
│ TTS (讯飞/浏览器) │◀──WS────▶│ WS :3001                 │──▶ LLM / TTS
│ LLM (代理)       │──HTTP───▶│ /api (LLM 代理)          │
└─────────────────┘           └──────────────────────────┘
```

**最小可玩路径**：仅前端 + LLM 即可对话；账号同步、成长落库、发音评测、服务端 ASR 需后端 HTTP。

---

## 部署

生产部署详见 [DEPLOY.md](./DEPLOY.md)，支持：

- **方案 A**：cloudflared 隧道（路演最快）
- **方案 B**：Docker Compose + Nginx 反代 + HTTPS
- **方案 C**：Vercel / 静态托管 + 独立后端

数据库使用 SQLite bind mount（`/srv/speakcoach/db/`），配套定时备份脚本见 `scripts/backup-db.sh`。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [specs/01-PRD.md](./specs/01-PRD.md) | 产品需求与用户故事 |
| [specs/02-SDD.md](./specs/02-SDD.md) | 系统设计、接口契约 |
| [specs/03-TDD-GUIDE.md](./specs/03-TDD-GUIDE.md) | 测试规范 |
| [specs/04-TASKS.md](./specs/04-TASKS.md) | 开发任务清单 |
| [openspec/specs/voice-input-transcript/spec.md](./openspec/specs/voice-input-transcript/spec.md) | 语音预览增量追加与转写规范化 |
| [DEPLOY.md](./DEPLOY.md) | 部署指南 |
| [AGENTS.md](./AGENTS.md) | AI 编码助手规则 |

---

## License

Private — 黑客松项目。
