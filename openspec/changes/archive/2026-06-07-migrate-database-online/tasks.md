## 1. 服务器宿主目录与权限准备

- [ ] 1.1 在线上服务器执行 `sudo mkdir -p /srv/speakcoach/db /srv/speakcoach/backups /srv/speakcoach/scripts`，建立持久化、备份、脚本三个目录。
- [ ] 1.2 设置目录属主与权限：因 server 容器当前以 root 运行（`server/Dockerfile` 未声明 `USER`），目录 `chown root:root` + `chmod 750`；记录决策，待未来给 Dockerfile 加 `USER node` 时同步改成 `chown 1000:1000`。
- [ ] 1.3 在服务器装 SQLite CLI（`apt-get install -y sqlite3` 或 `yum install -y sqlite`），后续迁移与备份脚本均依赖 `sqlite3` 命令。
- [ ] 1.4 在服务器装 `flock`（多数发行版自带，确认 `which flock` 不空）；备份脚本互斥锁需要它。

## 2. docker-compose 切到 bind mount

- [x] 2.1 修改根目录 `docker-compose.yml`：把 `services.server.volumes` 中 `- speakcoach-db:/data` 改为 `- /srv/speakcoach/db:/data`。
- [x] 2.2 删除文件末尾顶层 `volumes:` 段中的 `speakcoach-db:` 声明（命名卷不再被声明，保留在 docker daemon 里 7 天作回滚保险，不影响 compose 语义）。
- [x] 2.3 在 `docker-compose.yml` 顶部注释里加一行说明："数据库文件落在 /srv/speakcoach/db/，备份在 /srv/speakcoach/backups/，详见 DEPLOY.md §8。"
- [x] 2.4 本地 lint：`docker compose config` 输出无错。
- [x] 2.5 本地 dry-run：用 fake `/srv/speakcoach/db/` 路径在开发机模拟一次 `docker compose up -d --build`（或仅 `docker compose config`），确认 bind 解析正确、容器内仍能写 `/data/app.db`。

## 3. 一次性迁移脚本

- [x] 3.1 新建 `scripts/migrate-db-volume-to-bind.sh`，按 design.md D3 流程实现：前置检查（目录存在、属主正确、`sqlite3`/`docker compose` 可用、命名卷 `speakcoach-db` 存在）→ `docker compose stop server` → 临时目录 `mktemp -d` → 用 alpine 容器从命名卷拷 `app.db` 与 `app.db-wal`/`app.db-shm`（若存在）→ `sqlite3 PRAGMA integrity_check` 校验 → `set -e` 失败即终止；通过则 `mv` 入 `/srv/speakcoach/db/`、`chown` 与目录约定一致；最后**不**自动 `docker compose up`，由运维确认 compose 已切到 bind mount 后手工启动。
- [x] 3.2 脚本对"目标 bind 目录已有 `app.db`"做保护：先 `cp` 到 `/srv/speakcoach/backups/pre-migrate-<TS>.db` 再覆盖，并在终端打印明确告警。
- [x] 3.3 脚本顶部加 `set -euo pipefail` 与帮助文本（`-h` 输出用法 / 风险 / 回滚步骤）；所有路径变量集中在文件顶部便于改。
- [x] 3.4 chmod 0755；执行 `bash -n scripts/migrate-db-volume-to-bind.sh` 静态检查通过；可选 `shellcheck` 不报 error。

## 4. 定时备份脚本

- [x] 4.1 新建 `scripts/backup-db.sh`，按 design.md D4 实现：变量化 `SRC` / `DST_DIR` / 保留窗口（默认 `DAY_KEEP=7`、`WEEK_KEEP=4`）；`flock -n` 防并发；`sqlite3 .backup` 在线快照；备份完成后 `PRAGMA integrity_check` 二次校验；周日 (`date +%u = 7`) 额外打 weekly 副本；`ls -1t … | tail -n +N | xargs -r rm` 滚动清理。
- [x] 4.2 脚本失败路径：备份生成失败 / 校验失败 → 非零退出 + `>&2` 打印到 stderr，便于 cron MAILTO 捕获。
- [x] 4.3 chmod 0755；本地以 dummy `/tmp/test-db.db`（含至少一张表）跑一次冒烟，确认目标 `*.db` 可被 `sqlite3 .open` 打开。
- [x] 4.4 在脚本末尾留一段被注释掉的"异地备份钩子"示例（如 `# aws s3 cp ...` / `# ossutil cp ...`），方便后续接云。

## 5. DEPLOY.md 文档化

- [x] 5.1 在 `DEPLOY.md` 末尾新增 `## 8. 线上数据库目录与备份` 章节，子节按 design.md D6 列出 6 项：目录约定 / compose 配置示例 / 首次部署（冷启 vs 迁移）/ 备份配置 / 灾难恢复 / 后续扩展点。
- [x] 5.2 在"目录约定"小节给出完整命令清单：`mkdir`、`chown`、`chmod`，并标注"容器以 root 运行时使用 root:root；改用非 root 后改 1000:1000"。
- [x] 5.3 在"备份配置"小节给出 `crontab -e` 的可复制粘贴行：`0 3 * * * /srv/speakcoach/scripts/backup-db.sh >> /var/log/speakcoach-backup.log 2>&1`，并提示如何把脚本放到服务器（建议 `rsync scripts/ root@host:/srv/speakcoach/scripts/`）。
- [x] 5.4 在"灾难恢复"小节写出三段命令：(a) 找最新可用备份 `ls -1t /srv/speakcoach/backups/app-*.db | head`；(b) 停服 + 拷回 + 起服；(c) 验证登录 / 历史对话 / 瓜友列表。
- [x] 5.5 在第 0 节"架构与端口"或新建小节里更新一行："数据库 = SQLite，文件位于 `/srv/speakcoach/db/app.db`，备份位于 `/srv/speakcoach/backups/`。"
- [x] 5.6 引用 OpenSpec 变更：DEPLOY.md 该新章节末尾加一行 "详细方案见 `openspec/changes/migrate-database-online/`"。

## 6. 上线执行（运维操作）

- [ ] 6.1 PR 合并 → 拉 main → 在服务器项目目录 `git pull` 拿到新 compose 与脚本（暂不重启服务）。
- [ ] 6.2 按任务 1.x 完成宿主目录与权限准备。
- [ ] 6.3 跑 `bash scripts/migrate-db-volume-to-bind.sh`，观察输出全过程（停服 → dump → integrity_check ok → 入目录）；脚本退出码 0 才进入下一步。
- [ ] 6.4 `docker compose up -d server` 启动新容器；`docker compose logs -f server` 看日志，确认 Prisma migrate deploy 与 server 启动无错。
- [ ] 6.5 业务回归（人工）：登录任一账号、打开历史对话至少一条、看瓜田、看瓜友列表、看成长 Report。期望与迁移前完全一致。
- [ ] 6.6 安装 cron：`crontab -e` 加任务 5.3 行；24 小时后查看 `/var/log/speakcoach-backup.log` 与 `/srv/speakcoach/backups/` 第一份每日备份。
- [ ] 6.7 在团队 doc / README 顶层 release notes 标注："数据库已迁至 bind mount，旧命名卷 `speakcoach-db` 保留 7 天作回滚。"

## 7. 收尾与验证

- [ ] 7.1 7 天观察期内每天检查备份目录文件数与最近一份 `PRAGMA integrity_check`，无异常。
- [ ] 7.2 7 天后手工执行 `docker volume rm speakcoach-db` 释放空间；记录在 ops 日志。
- [ ] 7.3 运行 `openspec validate migrate-database-online --strict` 通过。
- [ ] 7.4 PR 描述链接 `openspec/changes/migrate-database-online/`，列明涉及的 capability：`database-hosting`（NEW）。
- [ ] 7.5 合并并稳定 1 周后运行 `/opsx:archive migrate-database-online` 把 delta 合并回 `openspec/specs/`。

## 8. 可选 / 后续

- [ ] 8.1 给 `server/Dockerfile` 加 `USER node` + 调整 `WORKDIR` 属主；同步把宿主目录改 `chown 1000:1000`。属另一变更，本期不做。
- [ ] 8.2 备份脚本接入异地存储（OSS / S3 / R2）；属另一变更，本期不做。
- [ ] 8.3 评估是否切换到 Postgres：单独发起 `add-postgres-database` 变更。
