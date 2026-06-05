---
name: openspec-ff-change
description: 快进 OpenSpec 工件创建。当用户想快速创建实现所需的所有工件而不逐个步骤时使用。
license: MIT
compatibility: 需要 openspec CLI。
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.2"
---

快进工件创建 - 一次性生成开始实现所需的一切。

**输入**：用户的请求应包含变更名称（kebab-case 格式）或他们想要构建内容的描述。

**步骤**

1. **如果没有提供明确输入，询问他们想构建什么**

   使用 **AskUserQuestion 工具**（开放式，无预设选项）询问：
   > "你想处理什么变更？描述你想构建或修复的内容。"

   从他们的描述中派生一个 kebab-case 名称（例如，"添加用户认证" → `add-user-auth`）。

   **重要**：在不了解用户想要构建什么之前不要继续。

2. **创建变更目录**
   ```bash
   openspec new change "<name>"
   ```
   这会在 `openspec/changes/<name>/` 创建脚手架变更。

3. **读取项目库存文件**

   检查并读取 `openspec/project-inventory.md`：
   - 如果文件存在：读取内容作为设计工件的上下文
   - 如果文件不存在：跳过（不阻塞流程）

   库存文件内容将用于填充 design.md 的 `Reusable Components` 章节。

4. **获取工件构建顺序**
   ```bash
   openspec status --change "<name>" --json
   ```
   解析 JSON 以获取：
   - `applyRequires`：实现前需要的工件 ID 数组（例如，`["tasks"]`）
   - `artifacts`：所有工件及其状态和依赖的列表

5. **按顺序创建工件直到可以应用**

   使用 **TodoWrite 工具** 跟踪工件进度。

   按依赖顺序遍历工件（没有待处理依赖的工件优先）：

   a. **对于每个 `ready`（依赖已满足）的工件**：
      - 获取说明：
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - 说明 JSON 包括：
        - `context`：项目背景（对你的约束 - 不要包含在输出中）
        - `rules`：工件特定规则（对你的约束 - 不要包含在输出中）
        - `template`：用于输出文件的结构
        - `instruction`：此工件类型的模式特定指导
        - `outputPath`：写入工件的位置
        - `dependencies`：要阅读以获取上下文的已完成工件
      - 阅读任何已完成的依赖文件以获取上下文
      - **如果是 design.md 工件且库存文件存在**：
        - 将库存文件中的组件信息填入 `Reusable Components` 章节
        - 筛选与当前 changes 相关的组件
      - 使用 `template` 作为结构创建工件文件
      - 应用 `context` 和 `rules` 作为约束 - 但不要将它们复制到文件中
      - 显示简短进度："✓ 已创建 <artifact-id>"

   b. **继续直到所有 `applyRequires` 工件完成**
      - 创建每个工件后，重新运行 `openspec status --change "<name>" --json`
      - 检查 `applyRequires` 中的每个工件 ID 在工件数组中是否都是 `status: "done"`
      - 当所有 `applyRequires` 工件完成时停止

   c. **如果工件需要用户输入**（上下文不清楚）：
      - 使用 **AskUserQuestion 工具** 澄清
      - 然后继续创建

6. **显示最终状态**
   ```bash
   openspec status --change "<name>"
   ```

**输出**

完成所有工件后，总结：
- 变更名称和位置
- 已创建工件列表及简要描述
- 准备就绪："所有工件已创建！准备实现。"
- 提示："运行 `/opsx:apply` 或让我实现以开始处理任务。"

**工件创建指南**

- 遵循 `openspec instructions` 中每个工件类型的 `instruction` 字段
- 模式定义每个工件应包含什么 - 遵循它
- 在创建新工件前阅读依赖工件以获取上下文
- 使用 `template` 作为输出文件的结构 - 填写其部分
- **重要**：`context` 和 `rules` 是对你的约束，而不是文件的内容
  - 不要将 `<context>`、`<rules>`、`<project_context>` 块复制到工件中
  - 这些指导你写什么，但永远不应该出现在输出中

**护栏**
- 创建实现所需的所有工件（由模式的 `apply.requires` 定义）
- 在创建新工件之前始终阅读依赖工件
- 如果上下文关键不清楚，询问用户 - 但优先做出合理决定以保持动力
- 如果已存在同名变更，建议继续该变更
- 在写入后验证每个工件文件存在，然后再继续下一个
