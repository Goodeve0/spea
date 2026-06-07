#!/usr/bin/env bash
# migrate-db-volume-to-bind.sh
# 一次性迁移脚本：把 docker named volume `speakcoach-db` 内的 app.db
# 安全搬到 bind mount 目录 /srv/speakcoach/db/，并做完整性校验。
#
# 设计文档：openspec/changes/migrate-database-online/design.md (D3)
#
# 用法：
#   sudo bash scripts/migrate-db-volume-to-bind.sh
#
# 前置：
#   - 已新建 /srv/speakcoach/db、/srv/speakcoach/backups（参考 DEPLOY.md §8）
#   - 服务器已装 sqlite3 命令
#   - docker compose 项目处于 spea 仓库根目录可识别的状态
#
# 风险：
#   - 脚本会停止 server 容器，会有短暂停机
#   - 脚本不会删除命名卷，便于回滚（保留 7 天后再手工 docker volume rm speakcoach-db）
#   - 脚本不会修改 docker-compose.yml；compose 切换由 git 控制
#
# 回滚：
#   - 校验失败 → 脚本非零退出，命名卷与 compose 均未变 → docker compose up -d server 即恢复
#   - 切换 compose 后才发现问题 → 把 compose volumes 改回 `- speakcoach-db:/data`，up 即可

set -euo pipefail

# ===== 可调参数 =====
BIND_DIR="${BIND_DIR:-/srv/speakcoach/db}"
BACKUP_DIR="${BACKUP_DIR:-/srv/speakcoach/backups}"
VOLUME_NAME="${VOLUME_NAME:-speakcoach-db}"
COMPOSE_SERVICE="${COMPOSE_SERVICE:-server}"

usage() {
  sed -n '2,28p' "$0"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

log() { printf '[migrate-db] %s\n' "$*"; }
err() { printf '[migrate-db][ERROR] %s\n' "$*" >&2; }

# ===== 1. 前置检查 =====
log '前置检查 ...'
test -d "$BIND_DIR" || { err "$BIND_DIR 不存在；请先按 DEPLOY.md §8 创建"; exit 1; }
test -d "$BACKUP_DIR" || { err "$BACKUP_DIR 不存在；请先按 DEPLOY.md §8 创建"; exit 1; }
command -v sqlite3 >/dev/null || { err "缺少 sqlite3 命令"; exit 1; }
command -v docker >/dev/null || { err "缺少 docker 命令"; exit 1; }

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  err "未找到命名卷 $VOLUME_NAME；如已是空库重启动场景请直接冷启动而不跑此脚本"
  exit 1
fi

# 验证可识别 compose 项目
docker compose ps "$COMPOSE_SERVICE" >/dev/null || {
  err "无法识别 compose 服务 $COMPOSE_SERVICE；确认在仓库根目录运行"
  exit 1
}

# ===== 2. 停 server 容器（不删卷） =====
log "停止 compose 服务 $COMPOSE_SERVICE ..."
docker compose stop "$COMPOSE_SERVICE"

# ===== 3. 从命名卷拷数据到临时目录 =====
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
log "从命名卷 $VOLUME_NAME 拷出 app.db 到 $TMP_DIR ..."
docker run --rm \
  -v "$VOLUME_NAME":/src:ro \
  -v "$TMP_DIR":/dst \
  alpine sh -c '
    set -e
    test -f /src/app.db || { echo "[copy] 源端缺 app.db" >&2; exit 1; }
    cp /src/app.db /dst/
    [ -f /src/app.db-wal ] && cp /src/app.db-wal /dst/ || true
    [ -f /src/app.db-shm ] && cp /src/app.db-shm /dst/ || true
    [ -f /src/app.db-journal ] && cp /src/app.db-journal /dst/ || true
    ls -l /dst/
  '

# ===== 4. 完整性校验 =====
log '运行 PRAGMA integrity_check ...'
RESULT="$(sqlite3 "$TMP_DIR/app.db" 'PRAGMA integrity_check;')"
if [[ "$RESULT" != "ok" ]]; then
  err "integrity_check 输出：$RESULT"
  err '迁移终止；compose 与命名卷均未改动；docker compose up -d server 即可恢复服务'
  exit 1
fi
log 'integrity_check = ok'

# ===== 5. 目标目录已有文件保护 =====
if [[ -f "$BIND_DIR/app.db" ]]; then
  PRE_TS="$(date +%Y%m%d-%H%M%S)"
  log "$BIND_DIR/app.db 已存在；先备份到 $BACKUP_DIR/pre-migrate-$PRE_TS.db"
  cp "$BIND_DIR/app.db" "$BACKUP_DIR/pre-migrate-$PRE_TS.db"
fi

# ===== 6. 移入 bind 目录 =====
log "移动文件到 $BIND_DIR ..."
mv "$TMP_DIR"/* "$BIND_DIR/"

# 与 design.md D2 保持一致：当前 server 容器以 root 运行
chown -R root:root "$BIND_DIR"
chmod 750 "$BIND_DIR"

log '迁移文件完成。'

# ===== 7. 提示运维确认 compose 后再起服务 =====
cat <<'EOF'

[migrate-db] 数据已就位 /srv/speakcoach/db/

接下来手工执行：
  1. 确认 docker-compose.yml 中 server.volumes 已是
       - /srv/speakcoach/db:/data
     若仍是 - speakcoach-db:/data，请 git pull 拉取最新 compose
  2. docker compose up -d server
  3. docker compose logs -f server  # 看 Prisma migrate deploy 与 server 启动是否正常
  4. 业务回归（登录 / 历史对话 / 瓜友）

回滚（若步骤 2 后发现问题）：
  - 把 docker-compose.yml 中 server.volumes 改回 `- speakcoach-db:/data`
  - docker compose up -d server  即恢复 7 天前的命名卷数据
  - bind 目录里的最新写入若需保留，cp /srv/speakcoach/db/app.db 到对应位置后再切

命名卷 speakcoach-db 已保留作为回滚保险；
稳定 7 天后可手工 docker volume rm speakcoach-db 释放空间。
EOF
