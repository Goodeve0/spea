#!/bin/bash
# Agent 编辑文件后自动 ESLint + Prettier（对应 .claude/settings.json PostToolUse）
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | python3 -c "import sys,json; print(json.load(sys.stdin).get('file_path',''))" 2>/dev/null || true)

if [ -z "$file_path" ] || [ ! -f "$file_path" ]; then
  exit 0
fi

ext="${file_path##*.}"
case "$ext" in
  ts|tsx|js|jsx)
    cd "$(dirname "$0")/../.."
    npx eslint --fix "$file_path" 2>/dev/null || true
    npx prettier --write "$file_path" 2>/dev/null || true
    ;;
esac

exit 0
