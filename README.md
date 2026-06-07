# 英语口语顶呱呱（spea / speak-coach）

一个基于 Node.js + WebSocket + React 的 AI 英语口语陪练工具。在「面试 / 点餐 / 团建 / 演讲 Q&A」等场景里跟 AI 对话，拿到实时发音评测、语法纠正与课后报告。

> 在线访问：<https://spea.xiaoyangxiaozhang.xyz>

---

## 功能一览

- 🎤 **实时对话**：浏览器 WebSpeech / 服务端 ASR 任选其一，VAD 静默自动停止
- 🗣️ **TTS 朗读**：讯飞在线 TTS（默认） + 浏览器原生 TTS 兜底，支持调节语速
- ✍️ **语法纠错**：每轮回答给出 inline 纠正，可关闭
- 📊 **发音评测**：讯飞 ISE，按词级返回准确度 / 流利度 / 完整度
- 📝 **课后报告**：LLM 生成总览 + 雷达图 + 改进建议
- 🌱 **成长系统**：连击 / 等级 / 20 个成就（哈密瓜化），每日打卡热力图
- 👥 **瓜友 & 直播间**：好友邀请、共瓜直播、协作朗读
- 📱 **PWA**：可安装、离线缓存

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vite 5 + React 18 + TypeScript + Tailwind 3 + Zustand + React Router 6 |
| 后端 | Node 20 + ws + Express + Prisma + SQLite |
| LLM | OpenAI 兼容协议（默认 deepseek-v3 via qnaigc.com） |
| 语音 | 讯飞 TTS / ISE，浏览器 SpeechRecognition + SpeechSynthesis |
| 部署 | Docker Compose + Nginx + Let's Encrypt |

---

## 目录结构

```
spea/
├── web/              # 前端（Vite + React 18 + TS）
│   ├── src/
│   │   ├── audio/        # 录音 / TTS / VAD / 讯飞客户端
│   │   ├── hooks/        # useVoiceInput / useConversationLlm 等
│   │   ├── pages/        # ScenarioHub / Conversation / Report / Buddies / LiveRoom ...
│   │   ├── store/        # Zustand：session / settings / auth / buddy
│   │   ├── llm/          # 报告与提示生成
│   │   └── ws-client/    # WebSocket 客户端封装
├── server/           # 后端（Node + ws + Express + Prisma）
│   ├── src/
│   │   ├── gateway/ws-gateway.ts   # WebSocket 入口
│   │   ├── http/                   # REST：账号 / 数据 / Buddy
│   │   ├── modules/                # dialog / correction / report / asr / tts / pronunciation
│   │   └── lib/                    # llm-client / calendar
│   └── prisma/                     # schema + migrations
├── shared/           # 前后端共享类型与契约（@speak-coach/shared）
├── specs/            # 技术方案文档
├── openspec/         # OpenSpec 变更与规格
├── docker-compose.yml
└── DEPLOY.md         # 服务器部署手册
```

---

## 快速开始

### 1. 准备环境

- Node 20+
- npm 10+

### 2. 安装依赖

```bash
npm install
```

工作区会同时装好 `web` / `server` / `shared` 三个子包。

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并填入真实密钥：

```bash
cp .env.example .env
```

关键变量：

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `LLM_MODEL` | LLM 接入 |
| `XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET` | 讯飞 TTS / ISE |
| `JWT_SECRET` | 账号登录签名 |
| `DATABASE_URL` | 默认 `file:./server/prisma/dev.db` |
| `HTTP_PORT` / `WS_PORT` | 默认 3002 / 3001 |

前端构建变量放在 `web/.env.production`（生产）或 `web/.env.local`（开发）：

```env
VITE_SERVER_URL=http://localhost:3002
VITE_OPENAI_API_KEY=...
VITE_OPENAI_BASE_URL=...
VITE_LLM_MODEL=deepseek-v3
```

### 4. 初始化数据库

```bash
npm run --workspace server prisma:migrate
```

### 5. 启动

```bash
# 同时起前后端
npm run dev

# 或分开起
npm run dev:server   # http://localhost:3002 + ws://localhost:3001
npm run dev:web      # http://localhost:5173
```

---

## 常用脚本

```bash
npm run dev          # 同时启动前后端
npm run build        # 构建 shared / server / web
npm run test         # 运行所有单元测试
npm run lint         # 类型检查
```

子包脚本：

```bash
npm run --workspace web build         # 仅构建前端
npm run --workspace web test:e2e      # Playwright 冒烟测试
npm run --workspace server test       # vitest
```

---

## 部署

详见 [`DEPLOY.md`](./DEPLOY.md)。简版：

```bash
# 在服务器上
git clone https://github.com/Goodeve0/speak-coach.git /www/wwwroot/spea
cd /www/wwwroot/spea
cp .env.example .env && vim .env                 # 填密钥
cp web/.env.example web/.env.production && vim web/.env.production

# 后端：Docker Compose
docker compose up -d --build

# 前端：用同镜像跑 vite build，把 dist 交给 Nginx
docker run --rm -v $(pwd):/app -w /app spea-server \
  sh -c 'cd web && npx vite build'

# Nginx 反代 /api → :3002，/ws → :3001，根目录 → web/dist
```

> ⚠️ 浏览器要求 **HTTPS** 才能访问麦克风（除 `localhost` 外）。生产部署务必配域名 + 证书。

---

## 浏览器兼容性

| 平台 | 录音 | TTS |
| --- | --- | --- |
| Chrome / Edge 桌面 | ✅ Web Speech API | ✅ |
| Safari macOS | ⚠️ 需用户授权 | ✅ |
| **iOS Safari** | ❌ Web Speech API 不支持 → 自动切文字模式 | ✅ |
| 微信内置浏览器 | ❌ 同上 | ✅ |

iOS / 微信用户可使用「文字输入」走 LLM 全流程，TTS 朗读照常。

---

## 相关文档

- [`DEPLOY.md`](./DEPLOY.md) — 服务器部署手册
- [`英语口语陪练-技术方案.md`](./英语口语陪练-技术方案.md) — 技术方案
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code 协作规范
- [`AGENTS.md`](./AGENTS.md) — Agent 协作指南
- `openspec/` — OpenSpec 变更与规格

---

## License

私有项目，未授权请勿分发。
