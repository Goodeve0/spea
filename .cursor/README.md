# Cursor 配置

本目录由 `.claude/` 同步生成，供 Cursor IDE 使用。与 Claude Code 共用同一套规则、技能与工作流。

## 目录结构

```
.cursor/
├── hooks.json              # Hooks（格式化 + 停止前风格校验）
├── hooks/
│   └── format-after-edit.sh
├── rules/                  # Cursor Rules（.mdc）
│   ├── ai-code-rules.mdc   ← .claude/rules/ai-code-rules.md
│   ├── format.mdc
│   └── spea-workflow.mdc
├── commands/               # 斜杠命令（扁平命名）
│   └── opsx-*.md           ← .claude/commands/opsx/*.md
└── skills/                 # Agent Skills
    └── */SKILL.md          ← .claude/skills/
```

## 与 .claude 的对应关系

| Claude Code | Cursor |
|-------------|--------|
| `.claude/settings.json` → PostToolUse | `hooks.json` → `afterFileEdit` |
| `.claude/settings.json` → Stop | `hooks.json` → `stop` (prompt) |
| `.claude/rules/ai-code-rules.md` | `.cursor/rules/ai-code-rules.mdc` |
| `.claude/commands/opsx/apply.md` | `.cursor/commands/opsx-apply.md` |
| `.claude/skills/*` | `.cursor/skills/*` |

## 常用命令

在 Cursor 聊天中输入：

- `/opsx-new` — 创建 OpenSpec 变更
- `/opsx-apply` — 按 tasks 实现
- `/opsx-verify` — 验证实现
- `/opsx-archive` — 归档变更
- `/opsx-explore` — 探索模式

## 同步更新

修改 `.claude` 后，重新复制到 `.cursor`：

```bash
cp -R .claude/skills/* .cursor/skills/
for f in .claude/commands/opsx/*.md; do
  cp "$f" ".cursor/commands/opsx-$(basename "$f")"
done
# rules 需手动对齐 ai-code-rules.md → ai-code-rules.mdc
```

## 验证 Hooks

Cursor 设置 → **Hooks** 标签页，或查看 **Hooks** 输出通道。修改 `hooks.json` 后保存即生效，必要时重启 Cursor。
