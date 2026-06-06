---
name: openspec-sync-specs
description: 将变更中的增量规格同步到主规格。当用户想要用增量规格的更改更新主规格而不归档变更时使用。
license: MIT
compatibility: 需要 openspec CLI。
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
---

将变更中的增量规格同步到主规格。

这是一个**代理驱动**的操作 - 你将阅读增量规格并直接编辑主规格以应用更改。这允许智能合并（例如，添加场景而不复制整个需求）。

**输入**：可选择指定变更名称。如果省略，检查是否可以从对话上下文推断。如果模糊或不明确，必须提示可用变更。

**步骤**

1. **如果没有提供变更名称，提示选择**

   运行 `openspec list --json` 获取可用变更。使用 **AskUserQuestion 工具** 让用户选择。

   显示有增量规格的变更（在 `specs/` 目录下）。

   **重要**：不要猜测或自动选择变更。始终让用户选择。

2. **查找增量规格**

   在 `openspec/changes/<name>/specs/*/spec.md` 中查找增量规格文件。

   每个增量规格文件包含如下部分：
   - `## ADDED Requirements` - 要添加的新需求
   - `## MODIFIED Requirements` - 对现有需求的更改
   - `## REMOVED Requirements` - 要删除的需求
   - `## RENAMED Requirements` - 要重命名的需求（FROM:/TO: 格式）

   如果没有找到增量规格，通知用户并停止。

3. **对于每个增量规格，将更改应用到主规格**

   对于每个在 `openspec/changes/<name>/specs/<capability>/spec.md` 有增量规格的能力：

   a. **阅读增量规格** 以理解预期更改

   b. **阅读主规格** 在 `openspec/specs/<capability>/spec.md`（可能尚不存在）

   c. **智能应用更改**：

      **ADDED Requirements：**
      - 如果需求在主规格中不存在 → 添加它
      - 如果需求已存在 → 更新它以匹配（视为隐式 MODIFIED）

      **MODIFIED Requirements：**
      - 在主规格中找到需求
      - 应用更改 - 这可以是：
        - 添加新场景（不需要复制现有场景）
        - 修改现有场景
        - 更改需求描述
      - 保留增量中未提及的场景/内容

      **REMOVED Requirements：**
      - 从主规格中删除整个需求块

      **RENAMED Requirements：**
      - 找到 FROM 需求，重命名为 TO

   d. **如果能力尚不存在，创建新主规格**：
      - 创建 `openspec/specs/<capability>/spec.md`
      - 添加 Purpose 部分（可以简短，标记为 TBD）
      - 添加包含 ADDED 需求的 Requirements 部分

4. **显示摘要**

   应用所有更改后，总结：
   - 更新了哪些能力
   - 做了什么更改（需求添加/修改/删除/重命名）

**增量规格格式参考**

```markdown
## ADDED Requirements

### Requirement: New Feature
系统应该做一些新的事情。

#### Scenario: Basic case
- **WHEN** 用户做 X
- **THEN** 系统做 Y

## MODIFIED Requirements

### Requirement: Existing Feature
#### Scenario: New scenario to add
- **WHEN** 用户做 A
- **THEN** 系统做 B

## REMOVED Requirements

### Requirement: Deprecated Feature

## RENAMED Requirements

- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

**关键原则：智能合并**

与程序化合并不同，你可以应用**部分更新**：
- 要添加场景，只需在 MODIFIED 下包含该场景 - 不要复制现有场景
- 增量表示*意图*，而非整体替换
- 使用你的判断力合理地合并更改

**成功时的输出**

```
## 规格已同步：<change-name>

已更新主规格：

**<capability-1>**：
- 添加需求："New Feature"
- 修改需求："Existing Feature"（添加了 1 个场景）

**<capability-2>**：
- 创建了新规格文件
- 添加需求："Another Feature"

主规格现已更新。变更保持活跃 - 实现完成后归档。
```

**护栏**
- 在进行更改之前阅读增量和主规格
- 保留增量中未提及的现有内容
- 如果有不清楚的地方，请求澄清
- 在进行时显示你正在更改什么
- 操作应该是幂等的 - 运行两次应该给出相同结果
