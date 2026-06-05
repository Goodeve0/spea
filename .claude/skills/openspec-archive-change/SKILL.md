---
name: openspec-archive-change
description: 在实验性工作流中归档已完成的变更。当用户想要在实现完成后最终化并归档变更时使用。
license: MIT
compatibility: 需要 openspec CLI。
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
---

在实验性工作流中归档已完成的变更。

**输入**：可选择指定变更名称。如果省略，检查是否可以从对话上下文推断。如果模糊或不明确，必须提示可用变更。

**步骤**

1. **如果没有提供变更名称，提示选择**

   运行 `openspec list --json` 获取可用变更。使用 **AskUserQuestion 工具** 让用户选择。

   仅显示活跃变更（未归档）。
   如果可用，包括每个变更使用的模式。

   **重要**：不要猜测或自动选择变更。始终让用户选择。

2. **检查工件完成状态**

   运行 `openspec status --change "<name>" --json` 检查工件完成情况。

   解析 JSON 以理解：
   - `schemaName`：正在使用的工作流
   - `artifacts`：带有状态的工件列表（`done` 或其他）

   **如果任何工件不是 `done`：**
   - 显示警告列出未完成的工件
   - 使用 **AskUserQuestion 工具** 确认用户想要继续
   - 如果用户确认则继续

3. **检查任务完成状态**

   阅读任务文件（通常是 `tasks.md`）检查未完成任务。

   计算标记为 `- [ ]`（未完成）与 `- [x]`（完成）的任务。

   **如果发现未完成任务：**
   - 显示警告显示未完成任务数量
   - 使用 **AskUserQuestion 工具** 确认用户想要继续
   - 如果用户确认则继续

   **如果不存在任务文件：** 无需任务相关警告继续。

4. **评估增量规格同步状态**

   检查 `openspec/changes/<name>/specs/` 是否有增量规格。如果没有，无需同步提示继续。

   **如果存在增量规格：**
   - 将每个增量规格与 `openspec/specs/<capability>/spec.md` 对应的主规格比较
   - 确定将应用什么更改（添加、修改、删除、重命名）
   - 在提示前显示组合摘要

   **提示选项：**
   - 如果需要更改："立即同步（推荐）"、"不同步归档"
   - 如果已同步："立即归档"、"仍然同步"、"取消"

   如果用户选择同步，执行 /opsx:sync 逻辑（使用 openspec-sync-specs 技能）。无论选择如何都继续归档。

5. **执行归档**

   如果不存在则创建归档目录：
   ```bash
   mkdir -p openspec/changes/archive
   ```

   使用当前日期生成目标名称：`YYYY-MM-DD-<change-name>`

   **检查目标是否已存在：**
   - 如果是：失败并显示错误，建议重命名现有归档或使用不同日期
   - 如果否：将变更目录移动到归档

   ```bash
   mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
   ```

6. **显示摘要**

   显示归档完成摘要，包括：
   - 变更名称
   - 使用的模式
   - 归档位置
   - 规格是否已同步（如适用）
   - 关于任何警告的说明（未完成工件/任务）

**成功时的输出**

```
## 归档完成

**变更：** <change-name>
**模式：** <schema-name>
**归档到：** openspec/changes/archive/YYYY-MM-DD-<name>/
**规格：** ✓ 已同步到主规格（或"无增量规格"或"跳过同步"）

所有工件完成。所有任务完成。
```

**护栏**
- 如果未提供则始终提示变更选择
- 使用工件图（openspec status --json）进行完成检查
- 不要因警告阻止归档 - 只是通知并确认
- 移动到归档时保留 .openspec.yaml（它随目录一起移动）
- 显示发生了什么的清晰摘要
- 如果请求同步，使用 openspec-sync-specs 方法（代理驱动）
- 如果存在增量规格，始终运行同步评估并在提示前显示组合摘要
