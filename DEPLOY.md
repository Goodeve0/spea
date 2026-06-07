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

**数据库**：SQLite，文件位于宿主机 `/srv/speakcoach/db/app.db`（bind mount 到容器 `/data/app.db`），备份位于 `/srv/speakcoach/backups/`，详见 §8。

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
VITE_SERVER_URL=https://<你的后端域名>     # 账号/数据/瓜友 API（不带末尾斜杠）

# 【推荐】走后端 LLM 代理（key 不暴露到前端包）
VITE_API_BASE_URL=https://<你的后端域名>/api   # 后端已实现此代理（ws-gateway 同端口）
VITE_LLM_MODEL=deepseek-v3

# 【或】直连 LLM（key 会进前端包，仅演示用）
# VITE_OPENAI_API_KEY=<openai key>
# VITE_OPENAI_BASE_URL=https://api.qnaigc.com/v1
# VITE_LLM_MODEL=deepseek-v3
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
#    在 web/.env.production 写入（二选一）：
#    【推荐-代理】VITE_SERVER_URL=<BACKEND_URL>  VITE_API_BASE_URL=<BACKEND_URL>/api  VITE_LLM_MODEL=deepseek-v3
#    【直连-demo】VITE_SERVER_URL=<BACKEND_URL>  VITE_OPENAI_API_KEY=...  VITE_OPENAI_BASE_URL=...  VITE_LLM_MODEL=deepseek-v3
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
2. 环境变量填写（二选一）：
   - **推荐（后端代理）**：`VITE_SERVER_URL`、`VITE_API_BASE_URL`（值为后端公网地址 + `/api`）、`VITE_LLM_MODEL`
   - **直连（仅 demo）**：`VITE_SERVER_URL`、`VITE_OPENAI_API_KEY`、`VITE_OPENAI_BASE_URL`、`VITE_LLM_MODEL`
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
- **安全**：前端直连 LLM（设置 `VITE_OPENAI_API_KEY`）会把 key 打入前端包；生产部署推荐改用 `VITE_API_BASE_URL` 走后端代理（后端已实现，key 仅存于服务器端 `OPENAI_API_KEY`）。

---

## 7. 路演推荐打法

主线 **大屏用 Chrome 演示**（语音、动画最稳） + 旁边贴 **二维码**让评委用系统浏览器自己玩（方案 A 最快搭起来）。

---

## 8. 线上数据库目录与备份

> 解决"docker 命名卷藏在内部目录、运维不可见、容易被 `down -v` 删掉、没有备份"的问题。
> SQLite 不变；只是把 `app.db` 从命名卷搬到宿主机显式目录 + 加定时备份。
> 详细方案见 `openspec/changes/migrate-database-online/`。

### 8.1 目录约定

| 路径 | 作用 |
|------|------|
| `/srv/speakcoach/db/app.db` | 主数据库文件（bind mount 到容器 `/data/app.db`）|
| `/srv/speakcoach/backups/` | 滚动备份（每日 7 份 + 每周 4 份）|
| `/srv/speakcoach/scripts/` | 部署在服务器上的备份脚本 |

首次准备：
```bash
sudo mkdir -p /srv/speakcoach/db /srv/speakcoach/backups /srv/speakcoach/scripts
# 当前 server/Dockerfile 未声明 USER，容器内以 root 运行 → 宿主属主用 root:root
sudo chown -R root:root /srv/speakcoach
sudo chmod 750 /srv/speakcoach/db /srv/speakcoach/backups
# 若将来给 Dockerfile 加 USER node（uid=1000），同步改：
# sudo chown -R 1000:1000 /srv/speakcoach
sudo apt-get install -y sqlite3 util-linux   # util-linux 提供 flock
```

### 8.2 docker-compose 配置示例

`docker-compose.yml` 中 `services.server.volumes` 使用 bind mount（**不要**再用命名卷）：

```yaml
services:
  server:
    volumes:
      - /srv/speakcoach/db:/data
# 顶层不再声明 volumes: speakcoach-db
```

容器内 `DATABASE_URL=file:/data/app.db` 不变，server 与 Prisma schema 零改动。

### 8.3 首次部署

**冷启动（新机器，无历史数据）**：
```bash
git clone <repo> && cd spea
# 完成 8.1 的目录与权限准备
docker compose up -d --build
docker compose logs -f server   # 看 Prisma migrate deploy
```
首次启动时 Prisma 自动建库；关掉 logs 后业务即可使用。

**从命名卷迁移现有数据（已在线运行过的服务器）**：
```bash
# 1. 拉新版（含本变更的 docker-compose.yml + scripts/）
cd /opt/spea && git pull

# 2. 准备目录（参见 8.1）

# 3. 跑迁移脚本：停服 → 拷数据 → integrity_check → 入 bind 目录
sudo bash scripts/migrate-db-volume-to-bind.sh

# 4. 起服 + 看日志
docker compose up -d server
docker compose logs -f server

# 5. 业务回归（人工）：登录账号、看历史对话、看瓜田、看瓜友、看 Report
```
脚本若任一步失败会立即 `set -e` 退出，命名卷与 compose 都不受影响 → `docker compose up -d server` 即恢复。

### 8.4 定时备份配置

把脚本部署到服务器：
```bash
sudo rsync -av scripts/backup-db.sh /srv/speakcoach/scripts/
sudo chmod 0755 /srv/speakcoach/scripts/backup-db.sh
```

加 cron（root 身份）：
```bash
sudo crontab -e
# 每天 03:00 跑一次备份；周日额外打 weekly 副本（脚本内置）
0 3 * * * /srv/speakcoach/scripts/backup-db.sh >> /var/log/speakcoach-backup.log 2>&1
```

24 小时后验证：
```bash
ls -lt /srv/speakcoach/backups/ | head    # 应有 app-YYYYMMDD-HHMM.db
tail /var/log/speakcoach-backup.log
sqlite3 /srv/speakcoach/backups/app-*.db 'PRAGMA integrity_check'
```

保留策略：每日 7 份 + 每周（周日）4 份滚动；通过环境变量 `DAY_KEEP=14 WEEK_KEEP=8 /srv/speakcoach/scripts/backup-db.sh` 可临时改。

### 8.5 灾难恢复

数据库被损坏 / 误删 / 想回到某个时间点：
```bash
# 1. 找最新可用备份
ls -1t /srv/speakcoach/backups/app-*.db | head

# 2. 停服
docker compose stop server

# 3. 选一份完整性 OK 的备份覆盖回主目录
sqlite3 /srv/speakcoach/backups/app-20260607-0300.db 'PRAGMA integrity_check'   # 必须 ok
sudo cp /srv/speakcoach/backups/app-20260607-0300.db /srv/speakcoach/db/app.db
sudo chown root:root /srv/speakcoach/db/app.db   # 与 8.1 一致

# 4. 起服
docker compose up -d server
docker compose logs -f server

# 5. 业务回归
```

### 8.6 后续扩展点（可选）

- **异地备份**：在 `scripts/backup-db.sh` 末尾启用 `aws s3 cp` / `ossutil cp` / `rclone copy` 一行即可，把每日快照同步到云。
- **容器非 root 化**：给 `server/Dockerfile` 加 `USER node`，宿主目录 `chown 1000:1000`；属另一变更，本变更暂不动。
- **换 Postgres**：起新变更 `add-postgres-database`；那时本节"目录约定"自动作废，备份策略改 `pg_dump`。

### 8.7 命名卷收尾（迁移成功 7 天后）

```bash
# 确认新方案稳定运行 ≥ 7 天后
docker volume rm speakcoach-db
```
中间 7 天即"回滚保险期"：发现问题随时把 compose 改回 `- speakcoach-db:/data` 即恢复迁移前状态。
