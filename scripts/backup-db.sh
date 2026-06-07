#!/usr/bin/env bash
# backup-db.sh
# 定时备份 SQLite 数据库：sqlite3 .backup 在线一致快照 + 完整性校验 + 滚动保留。
#
# 设计文档：openspec/changes/migrate-database-online/design.md (D4)
#
# 用法：
#   /srv/speakcoach/scripts/backup-db.sh
#
# crontab 示例：
#   0 3 * * * /srv/speakcoach/scripts/backup-db.sh >> /var/log/speakcoach-backup.log 2>&1

set -euo pipefail

# ===== 可调参数 =====
SRC="${SRC:-/srv/speakcoach/db/app.db}"
DST_DIR="${DST_DIR:-/srv/speakcoach/backups}"
DAY_KEEP="${DAY_KEEP:-7}"     # 每日备份保留份数
WEEK_KEEP="${WEEK_KEEP:-4}"   # 每周备份保留份数（周日打）
LOCK_FILE="${LOCK_FILE:-/tmp/speakcoach-backup.lock}"

log() { printf '[backup-db %s] %s\n' "$(date +%FT%T)" "$*"; }
err() { printf '[backup-db %s][ERROR] %s\n' "$(date +%FT%T)" "$*" >&2; }

# ===== 互斥锁，防 cron 重叠 =====
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  err "另一备份进程在运行，跳过本次"
  exit 0
fi

# ===== 前置检查 =====
test -f "$SRC" || { err "源数据库不存在：$SRC"; exit 1; }
test -d "$DST_DIR" || { err "备份目录不存在：$DST_DIR"; exit 1; }
command -v sqlite3 >/dev/null || { err "缺少 sqlite3 命令"; exit 1; }

TS="$(date +%Y%m%d-%H%M)"
DAY_BACKUP="$DST_DIR/app-$TS.db"

# ===== 在线一致快照 =====
log "生成快照 $DAY_BACKUP"
sqlite3 "$SRC" ".backup '$DAY_BACKUP'"

# ===== 二次完整性校验 =====
RESULT="$(sqlite3 "$DAY_BACKUP" 'PRAGMA integrity_check;')"
if [[ "$RESULT" != "ok" ]]; then
  err "新备份 integrity_check 失败：$RESULT"
  rm -f "$DAY_BACKUP"
  exit 1
fi

SIZE_BYTES="$(stat -c %s "$DAY_BACKUP" 2>/dev/null || stat -f %z "$DAY_BACKUP")"
log "ok size=${SIZE_BYTES}B"

# ===== 周日额外打 weekly 副本 =====
if [[ "$(date +%u)" == "7" ]]; then
  WEEK_BACKUP="$DST_DIR/weekly-$TS.db"
  cp "$DAY_BACKUP" "$WEEK_BACKUP"
  log "周日 weekly 副本：$WEEK_BACKUP"
fi

# ===== 滚动清理 =====
prune() {
  local pattern="$1" keep="$2"
  # ls -1t：按修改时间倒序；保留前 keep 份，其余删除
  if compgen -G "$pattern" >/dev/null; then
    ls -1t $pattern 2>/dev/null | tail -n "+$((keep + 1))" | xargs -r rm -f
  fi
}
prune "$DST_DIR/app-*.db" "$DAY_KEEP"
prune "$DST_DIR/weekly-*.db" "$WEEK_KEEP"

log '完成'

# ===== 异地备份钩子（按需启用） =====
# aws s3 cp "$DAY_BACKUP" "s3://your-bucket/speakcoach/$(basename "$DAY_BACKUP")"
# ossutil cp "$DAY_BACKUP" "oss://your-bucket/speakcoach/$(basename "$DAY_BACKUP")"
