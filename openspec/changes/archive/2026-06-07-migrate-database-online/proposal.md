## Why

当前 SQLite 文件 `app.db` 落在后端容器的命名卷 `speakcoach-db` 内，仅存在于那台后端服务器上：本地开发用 `file:./dev.db`、生产用 `file:/data/app.db`。这造成几个真实风险：（1）服务器损坏、卷被误删（`docker volume rm`、`down -v`）即丢账号/对话/瓜友/成长全部数据；（2）没有任何线上备份，路演前一夜想恢复也没得恢复；（3）跨机器迁移要手抠卷里的文件、易出错。本次目标 —— **保持 SQLite 不动**，但把"数据库文件本身"放到一个公认的、可备份、可恢复的线上持久化位置，并把现有数据**完整搬过去**，换库不丢数据。

## What Changes

- 新增：服务器上"线上持久化目录"约定（例如 `/srv/speakcoach/db/app.db`），不再依赖 Docker 命名卷做唯一持久化。
- `docker-compose.yml`：把 `speakcoach-db:/data` 卷挂载改为 bind mount 到上述持久化目录；保留 `DATABASE_URL=file:/data/app.db`（容器内路径不变，避免改 Prisma）。
- 新增：定时备份机制（cron / `docker compose exec` + `sqlite3 .backup`），把 `app.db` 拷到备份目录（保留 N 份），保证"线上"含义包含可回滚。
- 新增：一次性迁移脚本，把现有命名卷 `speakcoach-db` 内的 `app.db` 安全拷贝到新持久化目录，校验大小 / SQLite `PRAGMA integrity_check`，再切流量。
- 文档：`DEPLOY.md` 增加"线上数据库目录、备份策略、灾难恢复"章节。
- **NOT BREAKING**：Prisma schema、`DATABASE_URL` 在容器内的形态不变；服务无需改代码。

## Capabilities

### New Capabilities
- `database-hosting`：线上 SQLite 数据库的存储位置约定、持久化目录管理、定时备份、灾难恢复流程。

### Modified Capabilities

无。本次不改任何现有 capability 的需求行为；账号、瓜友、成长记录等业务模块对数据库存在与否的依赖未变。

## Impact

- `docker-compose.yml`：volume 段从命名卷改为 bind mount。
- 服务器：新建持久化目录 `/srv/speakcoach/db/`、备份目录 `/srv/speakcoach/backups/`，文件属主与权限规划。
- `DEPLOY.md`：补"线上数据库 + 备份"小节。
- 新增脚本：`scripts/migrate-db-volume-to-bind.sh`（一次性）、`scripts/backup-db.sh`（定时）。
- Prisma / server 代码：**不变**。
- 现有部署：执行迁移脚本后，原 named volume 仅作回滚保险保留若干天，确认稳定后再清。
