---
name: clarify-confirm
description: 根据用户回答生成需求确认文档。在运行 /split-clarify 生成问题并获取用户回答后，使用此技能整合问题和答案，生成最终的需求规格说明书。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 需求确认 - Step 2: 生成确认文档

根据用户回答生成需求确认文档。

**命令**: `/clarify-confirm [--change <change-name>]`

**前置条件**:
- `requirements-clarification/` 文件夹存在
- 文件夹中包含 `clarification-questions.json` 和 `clarification-answers.json`

**输入文件夹**: `requirements-clarification/`（读取文件夹中的所有文件）
- 如果指定 `--change`: `openspec/changes/{change-name}/requirements-clarification/`
- 否则: `requirements-clarification/`

**输出文件夹**: `requirements-clarification/`
**主入口文件**: `clarified-requirements.md`
- 如果指定 `--change`: 输出到 `openspec/changes/{change-name}/requirements-clarification/`
- 否则: 输出到 `requirements-clarification/`

**特性**: 不进行任何交互，只读取文件并生成文档

---

## 命令用法

```bash
# 基础用法：从当前目录读取问题/回答，生成本地确认文档
/clarify-confirm

# 指定变更名称，处理指定 change 目录下的文件
/clarify-confirm --change add-user-auth
```

---

## 输入文件

### 场景 1: 独立运行（不指定 --change）

```
requirements-clarification/
├── clarification-questions.json   # Step 1 输出的问题列表
└── clarification-answers.json     # 用户回答（需要提前准备）
```

### 场景 2: 集成到 OpenSpec（指定 --change）

```
openspec/changes/{change-name}/
└── requirements-clarification/        # 输入文件夹（读取全部内容）
    ├── clarification-questions.json   # Step 1 输出
    ├── clarification-answers.json     # 用户回答
    └── [其他可能的辅助文件]
```

---

## 回答文件格式 (clarification-answers.json)

回答文件格式定义见模板：`openspec/schemas/trip-workflow/templates/clarification-answers.json`

**回答值格式**:
| inputType | value 类型 | 示例 |
|-----------|-----------|------|
| `SINGLE_SELECT` | string | `"A"` |
| `MULTI_SELECT` | string[] | `["A", "B"]` |
| `FREE_TEXT` | string | `"详细描述..."` |
| `CONFIRM` | boolean | `true` |
| `NUMBER` | number | `60` |

### 补充说明字段 (supplement)

对于 `SINGLE_SELECT`、`MULTI_SELECT` 和 `CONFIRM` 类型的问题，用户可以在答案中提供 `supplement` 字段来补充说明。

**处理规则**:
- `supplement` 字段为可选，用户可以选择是否填写
- `supplement` 内容会被整合到最终的需求文档中
- `FREE_TEXT` 和 `NUMBER` 类型通常不需要 supplement（值本身就是详细说明）

---

## 规则加载顺序

规则按照以下优先级加载（后加载的覆盖先加载的）：

1. **内置默认规则** - skill 内置的通用规则
2. **项目级规则** - `openspec/rules/clarification.md`
3. **变更级规则** - `openspec/changes/{name}/requirements-clarification/rules/clarification.md`

规则影响以下方面：
- 需求分类（changeType、functionType、priority）
- ID 生成格式（REQ-xxx）
- 章节组织方式
- 优先级排序规则
- 流程图（Mermaid）输出格式
- 文档输出结构

---

## 执行流程

### 1. 解析参数

- 解析 `--change` 参数确定输入/输出位置
- 如果指定 `--change`: 检查 `openspec/changes/{change-name}/` 是否存在

### 2. 加载规则

按照优先级加载规则文件：

1. 内置默认规则
2. `openspec/rules/clarification.md`（如果存在）
3. `openspec/changes/{name}/requirements-clarification/rules/clarification.md`（如果存在且指定了 --change）

### 3. 读取并验证

1. 读取 `clarification-questions.json`
2. 读取 `clarification-answers.json`
3. 对于未回答的问题，如果问题有 `defaultValue`，自动使用默认值作为答案
4. 验证答案格式正确（类型匹配）

**未回答问题的处理**:
- 如果问题有 `defaultValue`，使用默认值
- 如果问题没有 `defaultValue` 且未回答，在文档中标注为"未确认"

### 3.5 读取关联图片资源

从 `clarification-questions.json` 的 `requirements[].images` 中收集所有关联图片文件名，在 `resources/` 目录下查找对应文件。

**执行步骤**：
1. 遍历 `requirements` 数组，收集所有 `images` 字段中的文件名（去重）
2. 对每个图片文件名，检查 `resources/{filename}` 是否存在
3. 对存在的图片文件，使用 Read 工具读取（AI 可识别图片内容）
4. 将图片内容理解整合到对应需求的描述中

**图片引用格式**（在生成的 `clarified-requirements.md` 中）：
- 使用 Markdown 图片语法引用：`![{描述}](../resources/{filename})`
- 在需求描述中，对图片内容进行文字化描述，并附上图片引用
- 如果图片是 UI 设计图，提取关键交互元素和布局信息写入需求描述

**⚠️ 图片不存在时**：跳过该图片，不报错，在文档中标注"图片缺失: {filename}"。

### 4. 合并结果

将问题和回答合并：
- 根据 `questionId` 匹配问题和答案
- 将选项 ID 转换为实际标签
- 构建每个需求的澄清结果

### 5. 读取输出模板 ⭐

**必须步骤**：在生成输出前，必须先读取模板文件获取输出格式：

```bash
# 必须读取此模板
openspec/schemas/trip-workflow/templates/clarified-requirements.md
```

**读取模板后**：
- 严格按照模板中的章节结构生成输出
- 不得添加模板中未定义的章节
- 不得省略模板中定义的必要章节

### 6. 整合需求描述

**关键步骤**: 将澄清结果整合到需求描述中
- 以 `clarification-questions.json` 的 `requirements[].content` 为基础（这是完整的需求详细描述）
- 不单独显示问题和回答
- 将回答内容融入需求的详细规格
- 生成具体的验收标准
- 对有关联图片的需求，在描述中引用图片并附文字化描述

**⚠️ 禁止丢失 content 中的信息**：`content` 字段包含原始需求的完整详细描述，生成确认文档时必须保留所有业务细节、边界条件、交互说明等，不得只用标题或摘要替代。

### 7. 生成需求文档

输出 `clarified-requirements.md`，按照标准需求文档格式：
- 按变更类型分章节（新增/更新/移除）- 遵循规则中的 `changeType` 定义
- 按优先级排序 - 遵循规则中的 `priority` 定义
- 包含完整的需求描述和验收标准
- 使用规则中定义的 ID 格式（如 `REQ-{变更类型}-{序号}`）

**⚠️ 大文件写入**：当需求条目较多时，`clarified-requirements.md` 可能较大。如果预估超过 40 行，使用 `fsWrite` 写入文档头部，再用 `fsAppend` 逐章节追加。详见 `openspec/rules/file-writing.md`。

---

## 输出格式 (clarified-requirements.md)

输出格式定义见模板：`openspec/schemas/trip-workflow/templates/clarified-requirements.md`

业务可通过覆盖模板自定义输出格式。

生成标准需求文档格式，**不显示问题内容**，只展示已确认的需求。

---

## 文档生成规则

**重要**: 以下规则必须与 `openspec/rules/clarification.md` 中的定义保持一致。

### 整合澄清结果

将问题的回答整合到需求描述中，而不是单独列出问题：

**示例**:

原始需求: "用户登录功能"

澄清问题和回答:
- Q: 登录失败最大尝试次数？ A: 5次
- Q: 使用哪种认证方式？ A: JWT
- Q: Token 过期时间？ A: 30分钟

**整合后的需求描述**:
```
用户登录功能，使用 JWT 认证方式。登录失败最大尝试次数为 5 次，
超过后锁定账户。Token 过期时间为 30 分钟。
```

### 分类规则

根据需求的 `changeType` 分类到对应章节：
- `ADD` → 2.1 新增功能
- `UPDATE` → 2.2 更新功能
- `REMOVE` → 2.3 移除功能

### 优先级排序

每个章节内按优先级排序：
1. HIGH（高优先级）
2. MEDIUM（中优先级）
3. LOW（低优先级）

### 验收标准生成

根据澄清结果自动生成验收标准检查项。

---

## OpenSpec 集成

### 输出位置

确认文档生成后，位于：

```
openspec/changes/{change-name}/
└── requirements-clarification/        # 输出文件夹
    ├── clarified-requirements.md      # 主入口文件
    └── [未来可扩展其他需求文档]
```

### 后续流程

后续 OpenSpec 技能会自动检测并使用该文件：

1. **`openspec-new-change`** / **`openspec-continue-change`**:
   - 检测 `requirements-clarification/` 文件夹是否存在
   - 如果存在，读取文件夹中所有内容（主入口文件: `clarified-requirements.md`）
   - 自动填充到 proposal.md 的 Requirements Summary 章节

2. **proposal.md 模板**:
   ```markdown
   ## Requirements Summary

   **需求状态**: ✅ 已澄清
   **需求来源**: `requirements-clarification/clarified-requirements.md`
   **需求统计**: 从澄清文档中提取
   - 总数: X
   - ADD: Y | UPDATE: Z | REMOVE: W
   **关键澄清决策**: 列出重要的澄清结果
   ```

---

## 错误处理

### 缺少问题文件
```
错误: clarification-questions.json 不存在
位置: openspec/changes/{change-name}/requirements-clarification/
请先运行 /split-clarify --change {change-name} 生成问题列表
```

### 缺少回答文件
```
错误: clarification-answers.json 不存在
位置: openspec/changes/{change-name}/requirements-clarification/
请通过可视化系统或手动创建回答文件
```

### 回答格式错误
```
错误: 以下回答格式不正确:
- Q-002: 期望数组，实际为字符串

请修正后重试
```

### 变更目录不存在
```
错误: 变更目录不存在
openspec/changes/{change-name}/
请先运行: openspec new change "{change-name}"
```

---

## 护栏

### 基础护栏

- **只读取文件，不进行任何交互**
- **验证答案格式正确**
- **未回答的问题使用 defaultValue 作为默认答案**
- **--change 指定的变更必须存在**
- **保持问题和回答的对应关系**
- **生成的文档格式必须一致，便于后续流程使用**
- **必须遵循项目规则** - 按照 `openspec/rules/clarification.md` 中定义的规则生成文档：
  - changeType 分类必须使用规则中定义的关键词判断
  - functionType 分类必须使用规则中定义的关键词判断
  - priority 排序必须按照规则中定义的优先级（P0 > P1 > P2）
  - ID 格式必须符合规则中定义的格式（`REQ-{变更类型}-{序号}`）

### ⭐ 模板约束（必须遵守）

**输出必须严格符合模板格式！**

1. **必须先读取模板**
   - 执行前必须读取 `openspec/schemas/trip-workflow/templates/clarified-requirements.md`
   - 不得跳过此步骤

2. **严格遵循模板结构**
   - 输出的 Markdown 结构必须与模板一致
   - 必须包含模板定义的所有章节
   - 章节顺序必须与模板一致

3. **必要章节**
   - 文档概述（目的、范围、需求统计）
   - 业务流程图
   - 功能需求（按 ADD/UPDATE/REMOVE 分类）
   - 非功能需求
   - 约束与风险
   - 术语表
