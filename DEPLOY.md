# 部署指南（让评委扫码即用）

> 目标：路演时评委用手机扫码就能上手。本文给三种方案，按"路演当天最快"到"正式上线"排列。

---

## 0. 架构与端口

| 服务 | 端口 | 作用 | 公网必需？ |
|------|------|------|-----------|
| 前端（Vite 静态） | 5173/4173 | 页面、PWA | ✅ 必须（HTTPS） |
| 后端 HTTP API | 3002 | 账号 / 数据 / 成长 | ✅（用账号/同步时） |
| 后端 WS | 3001 | 讯飞 TTS / 服务端 ASR / 发音评测 | ⭕ 可选（浏览器 TTS 兜底） |

**核心对话**靠：浏览器语音识别（Chrome） + 浏览器/讯飞 TTS + LLM。**最小可玩**只需「前端 + LLM」，账号/成长需要后端 HTTP。

---

## 1. 环境变量速查

**后端**（docker-compose 自动从根 `.env` 读取）：
```
OPENAI_API_KEY=...        # LLM
OPENAI_BASE_URL=https://api.qnaigc.com/v1
LLM_MODEL=deepseek-v3
PRONUNCIATION_PROVIDER=iflytek
XFYUN_APP_ID=...          # 讯飞 发音评测 + TTS
XFYUN_API_KEY=...
XFYUN_API_SECRET=...
JWT_SECRET=<强随机串>      # 生产务必改
DATABASE_URL=file:/data/app.db   # 容器内由 compose 注入
```

**前端**（构建时注入，`web/.env.production` 或平台环境变量）：
```
VITE_SERVER_URL=https://<你的后端域名>     # 账号/数据 API（不带末尾斜杠）
# LLM：demo 直连（注意 key 会进前端包，仅演示用）
VITE_OPENAI_API_KEY=<openai key>
VITE_OPENAI_BASE_URL=https://api.qnaigc.com/v1
VITE_LLM_MODEL=deepseek-v3
# ⚠️ 不要设置 VITE_API_BASE_URL（那是走后端 LLM 代理，当前未实现，设了会调不通）
```

---

## 2. 方案 A：路演当天最快（cloudflared 隧道，零服务器）

> 适合 demo 当天。用 Cloudflare 临时隧道把本机服务暴露成公网 HTTPS。
> 安装：`brew install cloudflared`（或官网下载）。

```bash
# 1) 起后端（HTTP 3002 + WS 3001），读根 .env
npm run dev -w server

# 2) 暴露后端，拿到一个 https URL（记为 BACKEND_URL）
cloudflared tunnel --url http://localhost:3002

# 3) 用 BACKEND_URL 配置前端并构建
#    在 web/.env.production 写入：
#    VITE_SERVER_URL=<BACKEND_URL>
#    VITE_OPENAI_API_KEY=...  VITE_OPENAI_BASE_URL=...  VITE_LLM_MODEL=deepseek-v3
npm run build -w web
npx vite preview --host --port 4173 -w web    # 或 cd web && npx vite preview --host

# 4) 暴露前端，拿到 https URL（记为 FRONTEND_URL）
cloudflared tunnel --url http://localhost:4173
```

把 **FRONTEND_URL 生成二维码**（见第 5 节），评委扫码即用。
> 讯飞 TTS / 服务端 ASR（WS 3001）如需公网，再单独 `cloudflared tunnel --url http://localhost:3001` 并把 WS 地址配进前端；不配则用浏览器 TTS，不影响主流程。

---

## 3. 方案 B：自建一台服务器（docker-compose + 隧道/反代）

> 适合长期可用。后端用 Docker 一键起，SQLite 持久化到卷。

```bash
# 在服务器上，项目根目录
docker compose up -d --build      # 起后端，3001/3002，数据落命名卷 speakcoach-db
```

HTTPS 暴露二选一：
- **简单**：`cloudflared tunnel --url http://localhost:3002`（后端）；前端走 Vercel（方案 C）。
- **自有域名**：用 Caddy 反代自动签证书（前端静态 + /→dist、API→3002、/ws→3001）。

前端：`npm run build -w web` 后把 `web/dist` 交给任意静态托管（Vercel / Nginx / Caddy）。

---

## 4. 方案 C：Vercel（前端） + 容器（后端）

**前端（Vercel，自带 HTTPS）**：
1. 导入仓库，Root Directory 选 `web`（已带 [`vercel.json`](web/vercel.json)：SPA 重写 + SW 不缓存）。
2. 环境变量填：`VITE_SERVER_URL`、`VITE_OPENAI_API_KEY`、`VITE_OPENAI_BASE_URL`、`VITE_LLM_MODEL`。
3. Deploy，得到 `https://xxx.vercel.app`。

**后端**：用方案 B 的 docker-compose 放任意带公网的机器 / Render / Railway，把其公网地址填进前端的 `VITE_SERVER_URL`。

---

## 5. 生成二维码 + 评委引导

二维码（任选）：
```bash
# 命令行
brew install qrencode && qrencode -o qr.png "https://你的前端地址"
# 或在线：把 URL 贴到任意"二维码生成"网站
```

路演物料上写一句**引导**：
> 📱 请用**系统浏览器**（安卓 Chrome / iOS Safari）打开；若在微信里，点右上角「…」→「在浏览器打开」。

---

## 6. 已知兼容性（诚实说明）

- **语音识别**：Chrome/Edge 完美；iOS Safari / 微信内置浏览器**不支持**浏览器语音识别 → 应用会**自动切到文字模式**仍可完整体验。要让 iOS 也能"说"，需把识别切到服务端 ASR（后端已有，属增强项）。
- **麦克风**：需 HTTPS（隧道/Vercel 均满足）；微信内 WebView 录音受限 → 引导用系统浏览器。
- **PWA**：HTTPS 下可"添加到主屏"、离线打开外壳；`dev` 模式不注册 SW，需 `build`/部署后生效。
- **安全**：demo 用前端直连 LLM 会暴露 key；正式上线应在后端加 LLM 代理路由后改用 `VITE_API_BASE_URL`。

---

## 7. 路演推荐打法

主线 **大屏用 Chrome 演示**（语音、动画最稳） + 旁边贴 **二维码**让评委用系统浏览器自己玩（方案 A 最快搭起来）。
