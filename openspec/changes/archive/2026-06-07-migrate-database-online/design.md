## Context

当前 `docker-compose.yml` 用命名卷做唯一持久化：

```yaml
server:
  volumes:
    - speakcoach-db:/data
volumes:
  speakcoach-db:
```

容器内 `DATABASE_URL=file:/data/app.db`。问题：

- 命名卷只在 docker daemon 知情，运维容易在 `docker compose down -v` 或清理脚本里把它一起删掉。
- 没有任何独立备份；卷损坏即全丢账号、对话历史、瓜友、成长记录。
- 卷的位置 `/var/lib/docker/volumes/speakcoach-db/_data/` 不在常规备份扫描路径里。
- 跨机器搬迁要 `docker cp` + tar 转储，路径不显式。

约束：

- 路演阶段不想换数据库引擎（避免 Prisma provider 改动 + schema 兼容风险），仍用 SQLite。
- server 代码与 Prisma schema 不变；容器内连接串依旧 `file:/data/app.db`。
- 一个后端实例，单写者；不需要解决多机并发写入。
- 服务器是用户自管的 Linux 主机，可控。

## Goals / Non-Goals

**Goals:**
- 把 `app.db` 落到宿主机的**显式可见目录** `/srv/speakcoach/db/`，通过 bind mount 进容器，运维一眼可见、备份工具能直接扫到。
- 提供**安全的一次性迁移脚本**，把命名卷里的现网数据完整搬过去并校验完整性，校验失败时可零损失回滚到旧 compose。
- 提供**定时在线备份**，使用 SQLite `.backup` 命令保证快照一致；保留滚动每日 + 每周窗口。
- 把"线上数据库 + 备份 + 灾难恢复"写进 `DEPLOY.md`，让任意运维独立操作。

**Non-Goals:**
- 不换 DB 引擎到 Postgres / MySQL（属另一变更，需要时再起）。
- 不做主备复制 / 多机读写。
- 不接入云厂托管备份（OSS / S3 异地备份）—— 本期只做本地多副本，文档里给出"后续可扩展"的钩子。
- 不改前端 / 业务代码 / Prisma schema。
- 不实现自动事故恢复（恢复仍是手工命令，但 DEPLOY.md 必须能复制粘贴）。

## Decisions

### D1 — bind mount 到 `/srv/speakcoach/db/`，弃用命名卷

**决定**：`docker-compose.yml` 的 `volumes` 段改为：

```yaml
server:
  volumes:
    - /srv/speakcoach/db:/data
# 顶层 volumes: 段移除 speakcoach-db 声明
```

容器内路径仍是 `/data/app.db`，server 与 Prisma 零改动。

**为何选 X 而非 Y：**
- 备选 A（继续命名卷，加 cron 备份）：✗ 主存储仍藏在 docker 内部目录，运维不可见、不安全；只是在错误位置上贴创可贴。
- 备选 B（bind mount 到 `/var/lib/speakcoach/`）：✗ `/var/lib` 一般归属包管理器，混入业务数据不规范。
- 选定 ✓ `/srv/speakcoach/`：FHS 标准里 `/srv` 就是"本机对外提供的服务数据"目录，语义最贴合。

### D2 — 容器内 uid 与宿主目录权限

**决定**：在 server `Dockerfile` 现有的非 root 用户基础上，约定 server 进程 uid = 1000（与默认 `node` 镜像一致，需在 Dockerfile 里确认）。宿主目录用：

```bash
sudo mkdir -p /srv/speakcoach/db /srv/speakcoach/backups
sudo chown -R 1000:1000 /srv/speakcoach
sudo chmod 750 /srv/speakcoach/db /srv/speakcoach/backups
```

SQLite 的 `-journal` / `-wal` / `-shm` 临时文件需要在该目录可创建，所以是目录写权限而非仅文件。

**为何不在容器内 root 跑**：保持最小权限；SQLite 不需要特权。

**风险**：若 server Dockerfile 没显式设 user 而以 root 跑，bind mount 进来的 0:0 文件后续切换到非 root user 会权限失败。本变更 tasks 中**MUST 显式确认 Dockerfile 的 USER 指令**并把这步纳入迁移脚本前置检查。

### D3 — 一次性迁移脚本：先停服 + integrity_check 后才切

**决定**：脚本 `scripts/migrate-db-volume-to-bind.sh` 流程（伪代码）：

```bash
set -euo pipefail
BIND_DIR=/srv/speakcoach/db
BACKUP_DIR=/srv/speakcoach/backups

# 1. 前置检查：bind 目录存在、属主正确、sqlite3 已装
test -d "$BIND_DIR"
which sqlite3
docker compose ps server  # 确认能识别 compose 项目

# 2. 停 server 容器（不删卷！）
docker compose stop server

# 3. 从命名卷 dump 文件
TMP=$(mktemp -d)
docker run --rm -v speakcoach-db:/src -v "$TMP":/dst alpine sh -c \
  'cp /src/app.db /dst/ && [ -f /src/app.db-wal ] && cp /src/app.db-wal /dst/ || true; \
   [ -f /src/app.db-shm ] && cp /src/app.db-shm /dst/ || true'

# 4. 完整性校验
sqlite3 "$TMP/app.db" 'PRAGMA integrity_check' | grep -qx 'ok'  # 失败则 set -e 终止

# 5. 备份当前 BIND_DIR 内已有文件（如果是非首次执行）
test -f "$BIND_DIR/app.db" && cp "$BIND_DIR/app.db" "$BACKUP_DIR/pre-migrate-$(...).db"

# 6. 移入 bind 目录、修属主
mv "$TMP"/* "$BIND_DIR/"
chown -R 1000:1000 "$BIND_DIR"

# 7. 提示运维确认 docker-compose.yml 已切到 bind mount，再 docker compose up -d server
```

**为何不脚本里直接改 compose**：compose 改动是"声明式配置"，需要 PR / 版本化提交；脚本只做数据搬运，配置切换走 git。

**为何停服而不在线 dump**：SQLite 在线 `.backup` 也安全，但停服一次性切换语义最简单、避免迁移期间用户写入造成 bind 目录与命名卷不一致；几分钟停机可接受。

**回滚路径**：脚本失败 → compose 未改 → 启回原容器 = 命名卷数据完好。即使脚本成功 + compose 切了之后发现问题，命名卷 7 天保留期内可改回 compose 即时回退。

### D4 — 备份脚本：sqlite3 .backup + 滚动保留

**决定**：`scripts/backup-db.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
SRC=/srv/speakcoach/db/app.db
DST_DIR=/srv/speakcoach/backups
TS=$(date +%Y%m%d-%H%M)
DAY_KEEP=7
WEEK_KEEP=4

# 在线一致快照（即使 server 在写入也安全）
sqlite3 "$SRC" ".backup '$DST_DIR/app-$TS.db'"
sqlite3 "$DST_DIR/app-$TS.db" 'PRAGMA integrity_check' | grep -qx 'ok'

# 周日额外打 weekly 标签
[ "$(date +%u)" = 7 ] && cp "$DST_DIR/app-$TS.db" "$DST_DIR/weekly-$TS.db"

# 滚动清理
ls -1t "$DST_DIR"/app-*.db | tail -n +$((DAY_KEEP+1)) | xargs -r rm
ls -1t "$DST_DIR"/weekly-*.db | tail -n +$((WEEK_KEEP+1)) | xargs -r rm
```

cron 配置（DEPLOY.md 提供）：

```cron
0 3 * * * /srv/speakcoach/scripts/backup-db.sh >> /var/log/speakcoach-backup.log 2>&1
```

**为何用 `sqlite3 .backup` 而不是 `cp`**：cp 在 server 写入时可能拷到未刷盘的页 → 备份文件 SQLite 打不开。`.backup` 走 SQLite 的在线备份 API，加锁拿一致快照。

**为何不上 cloud / S3**：本期范围限定本机；后续可在该脚本末尾 append `aws s3 sync` / `ossutil cp` 即可扩展，不影响主流程。

### D5 — 命名卷保留 7 天作为回滚保险

**决定**：迁移脚本**不**删 `speakcoach-db` 命名卷。`DEPLOY.md` 的迁移章节最后写一行 reminder："7 天后若运行稳定，可执行 `docker volume rm speakcoach-db`"。把删除动作留给人，不让脚本主动做不可逆操作。

### D6 — DEPLOY.md 章节结构

新章节标题：`## 8. 线上数据库目录与备份`，子节：
1. 目录约定（`/srv/speakcoach/db/`、`/srv/speakcoach/backups/`、属主权限）
2. compose 配置示例（bind mount 段）
3. 首次部署：冷启动 vs 从命名卷迁移（指向脚本）
4. 备份配置（脚本 + cron 示例）
5. 灾难恢复（从最新备份恢复的命令清单）
6. 后续扩展点（异地备份 / 换 Postgres 的指引位）

## Risks / Trade-offs

- **风险**：迁移脚本运行时如果 BIND_DIR 已存在旧的 `app.db`（运维误操作或重复跑脚本），直接 mv 会覆盖。
  → 缓解：脚本第 5 步对已有文件做 `pre-migrate-*.db` 备份后再覆盖；并打印明确提示。

- **风险**：服务器掉电时 SQLite WAL 文件未合并，bind mount 切换可能丢最近若干秒写入。
  → 缓解：脚本前先 `docker compose stop server` 让进程正常退出（触发 WAL checkpoint），再做拷贝。

- **风险**：cron 跑 `sqlite3 .backup` 时若用户量很大、单次备份超过 1 分钟，可能与下一次 cron 重叠。
  → 缓解：脚本起始处 `flock` 加文件锁，互斥执行。

- **风险**：bind 目录权限设错（如 chown 成 root:root）会导致 server 容器无法写。
  → 缓解：脚本前置检查目录属主，不通过则提前报错。

- **权衡**：仍用 SQLite，没有解决"多机部署 / 跨地域备份"的根本问题；本期接受，把"换 Postgres"留给独立后续变更。
  → 缓解：本期把 `DATABASE_URL` 用法收敛、文档化，后续切 Postgres 时只需改 schema provider + 跑迁移，不影响 server 业务代码。

## Migration Plan

1. PR 合并 + 镜像构建。
2. 服务器上：`mkdir + chown` 准备 `/srv/speakcoach/db|backups`。
3. 拉新 compose，先**不**起服务。
4. 跑 `scripts/migrate-db-volume-to-bind.sh`（停服 → dump → 校验 → 入 bind 目录）。
5. 检查 compose 已切到 bind mount，`docker compose up -d server`。
6. 验证：登录账号、看历史对话、看瓜田、瓜友列表，至少各一条用例。
7. 安装 cron：`crontab -e` 加备份任务，等 24h 看 `/var/log/speakcoach-backup.log`。
8. 7 天后稳定 → 手工 `docker volume rm speakcoach-db` 释放空间。

**回滚**：步骤 5 之前任何阶段失败 → 直接 `docker compose up -d server`（compose 未改）即恢复。步骤 5 之后失败 → 把 compose 改回命名卷段，`docker compose up -d server` 即恢复 7 天前的命名卷数据；7 天内的写入需手工合并（DEPLOY.md 给出复制 bind 文件回卷的命令）。

## Open Questions

- 是否本期就接入异地备份（如 OSS / S3）？建议本期不接，先观察本地备份是否稳定运行 1-2 周；接入入口已在 D4 备份脚本末尾留好。
- 备份保留窗口默认 7+4 是否够用？若数据增长很慢可以增大；初版先按这个值，DEPLOY.md 注明可改。
- 是否把 backup 脚本也容器化（compose service + cron sidecar）？本期选用宿主 cron，避免再起容器；将来若要离开宿主直接看日志，可改成 sidecar。
