# database-hosting Specification

## Purpose
约定 SQLite 数据库文件 `app.db` 在生产服务器的持久化位置、迁移流程、定时备份与灾难恢复策略，确保运维误操作（如删除 docker 命名卷）不会丢失账号、对话历史、瓜友、成长记录等业务数据。

## Requirements
### Requirement: 数据库文件持久化在服务器线上目录

`app.db` 文件 MUST 存放在服务器宿主机的固定持久化目录（约定为 `/srv/speakcoach/db/app.db`），并通过 docker bind mount 映射到容器内 `/data/app.db`。该目录 MUST 在删除 `docker compose down -v`、重建容器、删除 docker volume 等运维动作时**不被销毁**。生产环境 MUST NOT 再使用 docker 命名卷 `speakcoach-db` 作为唯一持久化位置。

容器内连接串保持 `DATABASE_URL=file:/data/app.db`，Prisma schema 与 server 代码 MUST 保持不变。

#### Scenario: 容器重建后数据保留
- **WHEN** 运维执行 `docker compose down && docker compose up -d --build`
- **THEN** `/srv/speakcoach/db/app.db` 文件未变，新容器启动后所有账号、对话、瓜友、成长记录均可读取

#### Scenario: 误删命名卷时数据仍存
- **WHEN** 运维执行 `docker volume rm speakcoach-db`（或 `docker compose down -v`）
- **THEN** 宿主机 `/srv/speakcoach/db/app.db` 不受影响；下次 `up` 起来仍可读取既有数据

#### Scenario: 持久化目录权限可写
- **WHEN** 容器以 server 服务用户启动
- **THEN** server 进程对 `/data/app.db`（即宿主 `/srv/speakcoach/db/app.db`）有读、写、创建临时文件（`-journal` / `-wal`）权限

### Requirement: 现有数据完整迁移到线上目录

变更上线时 MUST 提供一次性迁移脚本（位于 `scripts/migrate-db-volume-to-bind.sh`），把当前 docker 命名卷 `speakcoach-db` 内的 `app.db` 安全搬到 `/srv/speakcoach/db/app.db`。脚本执行 MUST：

1. 先停止 server 容器，避免迁移期间写入；
2. 从命名卷拷贝 `app.db`（含 `app.db-journal` / `app.db-wal` / `app.db-shm` 若存在）到目标目录；
3. 拷贝完成后对目标文件执行 `sqlite3 app.db 'PRAGMA integrity_check'`，结果 MUST 为 `ok`；
4. 校验失败时脚本 MUST 立即退出非零码，**不**修改 docker-compose 卷配置；
5. 校验通过后才允许切换 compose 至 bind mount 并重启容器；
6. 保留命名卷至少 7 天作为回滚保险，**不**在脚本里删除命名卷。

#### Scenario: 正常迁移整库
- **WHEN** 运维在装好 sqlite3 工具的服务器上以 root 身份运行迁移脚本
- **THEN** 容器停机 → app.db 拷至 `/srv/speakcoach/db/` → integrity_check 输出 `ok` → 切 compose → 起容器，账号登录、瓜田数据、对话历史无变化

#### Scenario: 完整性校验失败时不切流量
- **WHEN** 拷贝后 `PRAGMA integrity_check` 返回非 `ok`（文件损坏或拷贝中断）
- **THEN** 脚本以非零退出码终止，原 compose 配置（命名卷）保持不变；运维可重启原容器恢复服务

#### Scenario: 命名卷保留作回滚
- **WHEN** 迁移成功完成后
- **THEN** 命名卷 `speakcoach-db` MUST 仍存在；运维若发现新方案有问题，可改回 compose 卷配置直接回退

### Requirement: 定时备份与可回滚

线上数据库 MUST 配置定时备份，把 `app.db` 通过 SQLite 在线备份机制（`sqlite3 .backup` 或 `VACUUM INTO`）拷贝到独立备份目录（约定 `/srv/speakcoach/backups/`），保留最近 N 份（默认 7 份每日 + 4 份每周，可由脚本参数调整）。备份 MUST NOT 直接 `cp` 数据库文件，以避免在写入中读取到损坏快照。

#### Scenario: 每日备份生成
- **WHEN** 备份脚本被定时器（如 cron）触发
- **THEN** `/srv/speakcoach/backups/app-YYYYMMDD-HHMM.db` 文件生成，文件大小 > 0，且对该备份再跑 `PRAGMA integrity_check` 输出 `ok`

#### Scenario: 旧备份按保留策略清理
- **WHEN** 备份目录中每日备份数量超过保留上限
- **THEN** 最旧的每日备份被删除；每周备份按独立保留窗口管理，互不影响

#### Scenario: 从备份手工恢复
- **WHEN** 运维需要从某个备份回退：停 server → `cp /srv/speakcoach/backups/<name>.db /srv/speakcoach/db/app.db` → 起 server
- **THEN** server 启动后业务读取的是该备份时间点的数据；恢复流程 MUST 在 `DEPLOY.md` 中以可复制粘贴的命令形式记录

### Requirement: 部署文档涵盖线上数据库与备份

`DEPLOY.md` MUST 新增"线上数据库目录与备份"章节，至少包含：宿主目录约定（`/srv/speakcoach/db/`、`/srv/speakcoach/backups/`）、bind mount 配置示例、迁移脚本运行方式、备份脚本与 cron 配置示例、灾难恢复（从备份还原）的命令清单。任何运维人员 MUST 能仅凭该章节完成"首次部署"、"日常备份"、"事故恢复"三种动作。

#### Scenario: 文档可独立完成首次部署
- **WHEN** 新运维只读 `DEPLOY.md` 中的本章节
- **THEN** 能在新机器上正确建立持久化目录、配置 bind mount、跑通迁移或冷启动新库、设置每日备份 cron

#### Scenario: 文档可独立完成事故恢复
- **WHEN** 数据库损坏或被误删
- **THEN** 运维仅照该章节的恢复步骤即可从最近一份完整性校验通过的备份恢复服务，无需查阅源码或额外询问
