---
name: openspec-continue-change
description: 通过创建下一个工件来继续处理 OpenSpec 变更。当用户想要推进变更、创建下一个工件或继续工作流时使用。
license: MIT
compatibility: 需要 openspec CLI。
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
---

通过创建下一个工件来继续处理变更。

**输入**：可选择指定变更名称。如果省略，检查是否可以从对话上下文推断。如果模糊或不明确，必须提示可用变更。

**步骤**

1. **如果没有提供变更名称，提示选择**

   运行 `openspec list --json` 获取按最近修改时间排序的可用变更。然后使用 **AskUserQuestion 工具** 让用户选择要处理的变更。

   展示最近修改的前 3-4 个变更作为选项，显示：
   - 变更名称
   - 模式（来自 `schema` 字段，否则为"spec-driven"）
   - 状态（例如，"0/5 任务"、"完成"、"无任务"）
   - 最近修改时间（来自 `lastModified` 字段）

   将最近修改的变更标记为"（推荐）"，因为这可能是用户想要继续的。

   **重要**：不要猜测或自动选择变更。始终让用户选择。

2. **检查当前状态**
   ```bash
   openspec status --change "<name>" --json
   ```
   解析 JSON 以理解当前状态。响应包括：
   - `schemaName`：正在使用的工作流模式（例如，"spec-driven"）
   - `artifacts`：带有状态的工件数组（"done"、"ready"、"blocked"）
   - `isComplete`：布尔值，指示是否所有工件都已完成

3. **根据状态采取行动**：

   **如果所有工件都已完成（`isComplete: true`）**：
   - 祝贺用户
   - 显示包括所用模式的最终状态
   - 建议："所有工件已创建！你现在可以实现这个变更或归档它。"
   - 停止

   ---

   **如果有工件准备创建**（状态显示 `status: "ready"` 的工件）：
   - 从状态输出中选择第一个 `status: "ready"` 的工件
   - 获取其说明：
     ```bash
     openspec instructions <artifact-id> --change "<name>" --json
     ```
   - 解析 JSON。关键字段是：
     - `context`：项目背景（对你的约束 - 不要包含在输出中）
     - `rules`：工件特定规则（对你的约束 - 不要包含在输出中）
     - `template`：用于输出文件的结构
     - `instruction`：模式特定指导
     - `outputPath`：写入工件的位置
     - `dependencies`：要阅读以获取上下文的已完成工件
   - **创建工件文件**：
     - 阅读任何已完成的依赖文件以获取上下文
     - 使用 `template` 作为结构 - 填写其部分
     - 在编写时应用 `context` 和 `rules` 作为约束 - 但不要将它们复制到文件中
     - 写入说明中指定的输出路径
   - 显示创建了什么以及现在解锁了什么
   - 创建一个工件后停止

   ---

   **如果没有工件准备就绪（全部阻塞）**：
   - 这在有效模式下不应该发生
   - 显示状态并建议检查问题

4. **创建工件后，显示进度**
   ```bash
   openspec status --change "<name>"
   ```

**输出**

每次调用后，显示：
- 创建了哪个工件
- 正在使用的模式工作流
- 当前进度（N/M 完成）
- 现在解锁了哪些工件
- 提示："想继续吗？只需让我继续或告诉我下一步做什么。"

**工件创建指南**

工件类型及其用途取决于模式。使用说明输出中的 `instruction` 字段来理解要创建什么。

常见工件模式：

**spec-driven 模式**（proposal → specs → design → tasks）：
- **proposal.md**：如果不清楚，询问用户关于变更的信息。填写 Why、What Changes、Capabilities、Impact。
  - Capabilities 部分至关重要 - 列出的每个能力都需要一个规格文件。
- **specs/<capability>/spec.md**：为提案的 Capabilities 部分中列出的每个能力创建一个规格（使用能力名称，而不是变更名称）。
- **design.md**：记录技术决策、架构和实现方法。
- **tasks.md**：将实现分解为带复选框的任务。
  - 直接读取 design.md 作为技术方案来源

**trip-workflow 模式**（clarify → confirm → proposal → specs → design → [design-confirm] → tasks）：
- 包含需求澄清阶段（clarify → confirm）
- design 生成时同步产出澄清问题（design-questions.json），可选执行 design-confirm 回填
- tasks.md 直接读取 design.md

对于其他模式，遵循 CLI 输出中的 `instruction` 字段。

**护栏**
- 每次调用创建一个工件
- 在创建新工件之前始终阅读依赖工件
- 永远不要跳过工件或不按顺序创建
- 如果上下文不清楚，在创建前询问用户
- 在写入后验证工件文件存在，然后再标记进度
- 使用模式的工件序列，不要假设特定的工件名称
- **重要**：`context` 和 `rules` 是对你的约束，而不是文件的内容
  - 不要将 `<context>`、`<rules>`、`<project_context>` 块复制到工件中
  - 这些指导你写什么，但永远不应该出现在输出中
- **创建 tasks.md 时**：直接读取 design.md 作为技术方案来源
