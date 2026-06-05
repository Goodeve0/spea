---
name: split-confirm
description: 根据用户已确认的拆分方案（split-plan）执行 change 创建和澄清问题生成。要求 split-plan 的 metadata.status 为 confirmed，确保拆分计划经过用户明确确认后再执行。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
    author: openspec
    version: "2.0"
    generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 拆分确认 - 执行拆分方案

根据 `/split-clarify` 生成的 split-plan，创建独立 change 目录并为每组生成澄清问题。

**命令**: `/split-confirm <split-plan-file> [--name-prefix <prefix>] [--mcp <tools>]`

**前置条件**:

- split-plan JSON 文件存在（由 `/split-clarify` 生成）
- split-plan 的 `metadata.status` 已被用户/可视化系统更新为 `confirmed`

**输入**:

- split-plan 文件路径（必填，如 `openspec/split-plans/spea-split-20260605.json`）
- 名称前缀（可选，用于给生成的 change 目录名添加前缀；如果 split-plan 的 `metadata.namePrefix` 已有值则自动使用，无需重复指定）
- MCP 工具名列表（可选，用于在生成澄清问题时获取领域知识，逗号分隔，如 `--mcp openai` 或 `--mcp openai,azure-speech`）

**输出**:

- 为每个组创建独立 change 目录
- 每个 change 含 `requirements-clarification/clarification-questions.json`

**特性**:

- 不进行任何交互，只读取 split-plan 并执行
- 要求 split-plan 状态为 `confirmed`，确保拆分计划经用户明确确认后再执行
- 自动加载澄清规则生成问题
- split-plan 本身就是唯一的数据源，用户的调整（合并/移动/拆分）由可视化系统直接修改 split-plan

---

## 命令用法

```bash
# 基础用法（changeName 已在 split-plan 中包含前缀）
/split-confirm openspec/split-plans/spea-split-20260605.json

# 显式指定名称前缀（覆盖 split-plan 中的 namePrefix）
/split-confirm openspec/split-plans/split-20260605.json --name-prefix spea

# 指定 MCP 工具获取领域知识
/split-confirm openspec/split-plans/split-20260605.json --mcp openai

# 指定多个 MCP 工具（逗号分隔）
/split-confirm openspec/split-plans/split-20260605.json --mcp openai,azure-speech

# 组合使用：名称前缀 + MCP 工具
/split-confirm openspec/split-plans/split-20260605.json --name-prefix spea --mcp openai
```

---

## 前置条件

1. **split-plan 文件必须存在**：由 `/split-clarify` 生成，位于 `openspec/split-plans/` 目录
2. **split-plan 状态为 `confirmed`**：split-plan 必须已被用户/可视化系统明确确认
3. **原始需求文件可访问**：split-plan 中 `metadata.sourceFiles` 引用的文件必须存在于 `openspec/resources/`

---

## 规则和模板引用

### 澄清规则文件

澄清规则定义见：`openspec/rules/clarification.md`

**规则加载顺序**（后加载覆盖先加载）：

1. 内置默认规则
2. `openspec/rules/clarification.md`
3. `CLAUDE.md` 引入的 rules 或 `.cursor/rules/*.mdc`

### 大文件写入规则

大文件分段写入规范见：`openspec/rules/file-writing.md`

包含：写入策略选择（Shell 原子写入 / 分段追加写入）、JSON 分段方案、写入后校验。当 clarification-questions.json 或 split-plan 文件较大时必须遵循。

### 输出模板

**⭐ 必须严格按模板输出**

| 输出             | 模板路径                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| 澄清问题列表     | `openspec/schemas/trip-workflow/templates/clarification-questions.json` |
| 拆分计划（读取） | `openspec/schemas/trip-workflow/templates/requirement-split-plan.json`  |

执行前必须读取模板文件，输出的 JSON 结构必须与模板完全一致。

---

## 输出目录结构

```
openspec/
├── split-plans/
│   └── {namePrefix}-split-{timestamp}.json    # 已确认的 split-plan（status: confirmed → executing → completed）
└── changes/
    ├── {namePrefix}-{change-name-1}/              # 第一组（changeName 已含前缀）
    │   └── requirements-clarification/
    │       └── clarification-questions.json       # 该组的澄清问题
    ├── {namePrefix}-{change-name-2}/              # 第二组
    │   └── requirements-clarification/
    │       └── clarification-questions.json
    └── ...
```

---

## 执行流程

### 1. 解析参数

- 解析 split-plan 文件路径（必填）
- 解析 `--name-prefix` 参数（可选）
- 解析 `--mcp` 参数确定调用的工具（可选，逗号分隔）
- 验证文件路径格式正确

**namePrefix 优先级**：

1. `--name-prefix` 命令行参数（最高优先级）
2. split-plan 的 `metadata.namePrefix`（由 `/split-clarify` 写入）
3. 无前缀（两者都不存在时）

### 2. 读取并验证 split-plan

1. 读取指定的 split-plan JSON 文件
2. 验证 JSON 格式合法（`JSON.parse()` 可解析）
3. **验证 `metadata.status`**：
    - 如果 status 为 `pending_confirmation`：报错，提示用户先在可视化系统中确认拆分方案，然后再运行 `/split-confirm`
    - 如果 status 为 `confirmed`：继续执行
    - 如果 status 为 `completed`：报错，提示该拆分计划已执行完成，不允许重复执行
    - 如果 status 为 `skipped`：报错，提示该拆分计划已被跳过
4. 提取 `groups` 数组，确认至少有一个组

### 3. 加载规则和模板

#### 3a. 加载澄清规则

按优先级加载澄清规则：

1. 内置默认规则
2. `openspec/rules/clarification.md`
3. `CLAUDE.md` 引入的 rules 或 `.cursor/rules/*.mdc`

#### 3b. 读取输出模板

**必须步骤**：

- 读取 `openspec/schemas/trip-workflow/templates/clarification-questions.json`

#### 3c. MCP 预获取领域知识（如指定 --mcp）

如果指定了 `--mcp` 参数，在开始逐组生成澄清问题之前先建立领域认知。

**必须执行**：

1. **了解工具能力**：调用各 MCP 工具的帮助/文档接口，获取能力清单
2. **获取基础领域知识**：获取框架/平台的核心概念、组件清单、API 能力边界等
3. **建立术语映射**：将 MCP 返回的专有名词整理为术语表，供后续生成澄清问题时匹配使用

**⚠️ MCP 角色定位（必须遵守）**：

- MCP 是辅助 AI 理解需求文档中专业名词和概念的工具，**不是独立的需求来源**
- MCP 返回的信息用于帮助 AI 生成**有深度的澄清问题**（如"价格保护是否覆盖已付款订单？"），而非基础定义问题（如"什么是价格保护？"）
- 问题的依据仍必须来自需求文档本身，MCP 只提供背景认知

### 4. 读取原始需求文件

从 split-plan 的 `metadata.sourceFiles` 中获取原始需求文件路径，读取文件内容。

**⚠️ 禁止对目录路径调用 Read**：当路径为文件夹时，先列出目录内容，再对每个文件调用 Read。

### 5. 更新 split-plan 状态为 `executing`

将 split-plan 的 `metadata.status` 更新为 `executing`，表示正在执行 change 创建。

### 6. 逐组创建 change 并生成澄清问题

对 `groups` 数组中的每个组，按顺序执行以下操作：

#### 6.1 解决 change 名称冲突

**⛔ 必做步骤**：确保创建的 change 名称不与现有目录冲突。

1. **检查名称是否冲突**：检查 `openspec/changes/{changeName}/` 是否已存在
2. **自动解决冲突**：
    - 如果已存在：自动添加数字后缀 `-2`、`-3`、`-4` ... 直到找到可用名称
    - 后缀从 `-2` 开始（不使用 `-1`）
    - 例如：`user-management` 已存在 → 尝试 `user-management-2` → 如还存在 → 尝试 `user-management-3` ...
3. **记录解决结果**：在输出摘要中标注最终使用的 changeName（如有重命名）

**示例**：

```
原计划名称: payment-flow
openspec/changes/payment-flow/ 已存在
→ 检查 payment-flow-2 → 不存在
→ 最终使用: payment-flow-2
```

#### 6.2 创建 change 目录结构

**必须创建以下目录和文件**：

```
openspec/changes/{changeName}/
├── .openspec.yaml       # ⭐ OpenSpec 标识文件（必须）
├── metadata.json        # ⭐ 变更元数据（必须，见下方模板）
└── requirements-clarification/
    └── clarification-questions.json
```

**⛔ 路径与 `stage` 语义（必守）**

- 本节及以下 JSON 模板**仅**用于 **`openspec/changes/{changeName}/metadata.json`**（**变更**工作流阶段，即 `ChangeWorkflowStage`）。
- **`openspec/resources/{resourceName}/metadata.json`** 是**需求资源**元数据，其 `stage` 只能是 `requirements-analyze`、`split-clarify`、`split-confirmed`（由产品 Web/API 写入与规范化）。**禁止**用下方 change 模板去创建、覆盖或合并进资源 `metadata.json`；否则可视化「需求录入」主区可能无法匹配阶段而空白。

**⭐ 6.2.1 创建 .openspec.yaml**

在 change 根目录创建 `.openspec.yaml` 文件，内容如下：

```yaml
schema: trip-workflow
created: { YYYY-MM-DD }
```

其中 `{YYYY-MM-DD}` 为当前日期（ISO 8601 格式的日期部分，如 `2026-03-20`）。

**⭐ 6.2.2 初始化 metadata.json**

在 change 根目录创建 `metadata.json` 文件，**必须包含以下字段**：

```json
{
    "stage": "requirements-clarify",
    "createdAt": "{ISO 8601 timestamp}",
    "source": "split-confirm",
    "splitPlanFile": "{split-plan 文件名}",
    "groupId": "{该组的 ID}",
    "groupName": "{该组的名称}"
}
```

**字段说明**：

- `stage`: 固定为 `"requirements-clarify"`（**仅 change**：split-confirm 创建的变更直接进入需求澄清阶段；**不是** resource 的 `stage`）
- `createdAt`: 当前时间的 ISO 8601 格式（如 `2026-03-20T07:30:45.123Z`）
- `source`: 固定为 `"split-confirm"`，标识来源
- `splitPlanFile`: split-plan 文件名（如 `spea-split-20260605.json`）
- `groupId`: 该组在 split-plan 中的 ID（如 `RG-1`）
- `groupName`: 该组的名称（如 `用户管理模块`）

**参考现有 change 的 metadata.json 结构**：参照 `openspec/changes/` 下已存在 change 的 metadata.json，确保字段格式一致。

#### 6.3 生成澄清问题 (clarification-questions.json)

为该组的需求条目生成澄清问题：

1. 从 split-plan 中提取该组包含的需求条目（使用 `requirements[].content` 中的完整详细描述）
2. 按照澄清规则分析需求，识别模糊点和缺失信息
3. **MCP 动态查询**：如果指定了 `--mcp`，在分析过程中遇到不理解的术语或概念时，按需调用 MCP 工具动态查询，获取更深入的领域理解，从而生成更有针对性的问题（而非"什么是 X"这类基础定义问题）
4. 生成问题列表，严格按照 `clarification-questions.json` 模板输出
5. 问题 ID 格式：`Q-{NNN}`，从 001 开始递增

**⚠️ 大文件写入**：clarification-questions.json 在 requirements 较多或 questions 较多时可能超出单次写入限制。**必须遵循 `openspec/rules/file-writing.md` 中的大文件分段写入规范**，优先使用 Shell 原子写入（策略 A），不可用时使用分段追加写入（策略 B）。

**⚠️ requirements[].content 必须完整传递**：将 split-plan 中每个需求的 `content` 字段完整写入 `clarification-questions.json` 的 `requirements[].content`，不做压缩或摘要。这是后续 `/clarify-confirm` 生成确认文档的唯一数据源。

**⚠️ requirements[].images 必须完整传递**：将 split-plan 中每个需求的 `images` 数组完整写入 `clarification-questions.json` 的 `requirements[].images`。

**⚠️ 零问题场景**：如果分析后没有需要澄清的问题，仍然**必须生成** `clarification-questions.json` 文件，`questions` 数组为空，`metadata.totalQuestions` 为 0。

#### 6.4 JSON 校验与修正（⛔ 必做，不可跳过）

对生成的 `clarification-questions.json` 执行校验与修正：

1. **校验**

    - 用 Read 工具读回刚写入的 `clarification-questions.json`
    - 用可用的校验手段判断是否为合法 JSON（例如：执行
      `node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('OK')}catch(e){console.error(e.message);process.exit(1)}" "<file-path>"`
      若输出 `OK` 且退出码 0 则通过）

2. **不通过时修正**

    - 根据校验报错定位并修正所有导致 JSON 无效的语法错误
    - 将修正后的完整内容再次写入同一文件

3. **重复**
    - 再次执行步骤 1。若仍不通过，重复步骤 2 和 1，直到校验通过为止

**结束条件**：校验通过后方可继续处理下一组。

### 7. 更新 split-plan 最终状态

所有组处理完成后：

- 将 `metadata.status` 更新为 `completed`
- 将 `metadata.confirmedAt` 更新为当前时间（ISO 8601 格式）
- 写回 split-plan 文件

**⚠️ 大文件写入**：split-plan 文件在 groups 较多时可能较大。写回时**必须遵循 `openspec/rules/file-writing.md` 中的大文件分段写入规范**。

### 8. 输出执行摘要

```
✅ 拆分确认执行完成
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
拆分计划: {split-plan 文件名}
总组数: {N}  |  已创建: {M}  |  已跳过: {K}

┌──────┬──────────────────┬──────────────────────┐
│ 组   │ Change 名称      │ 澄清问题数           │
├──────┼──────────────────┼──────────────────────┤
│ RG-1 │ {changeName}     │ {N} 个问题           │
│ RG-2 │ {changeName}     │ {N} 个问题           │
└──────┴──────────────────┴──────────────────────┴──────────┘

下一步:
  对每个 change 回答澄清问题，然后运行:
  /clarify-confirm --change {changeName}
```

---

## 护栏

### ⛔ 核心护栏

1. **split-plan 状态必须为 `confirmed`** — 只有用户在可视化系统中明确确认后才允许执行
2. **不允许重复执行** — status 为 `completed` 的 split-plan 不允许再次执行
3. **不进行任何交互** — 只读取 split-plan 并执行，不询问用户
4. **需求守恒** — 创建的 change 必须覆盖 split-plan 中所有组的需求，不允许丢失
5. **⛔ 文件产物必须生成** — 每个组的 `clarification-questions.json` 必须写入，且必须完成 JSON 校验与修正

### ⭐ 模板约束

1. **必须先读取模板**（澄清问题模板）
2. **输出结构必须与模板一致**
3. **不得增减模板定义的字段**

### 澄清护栏

所有问题必须有文档依据：

1. **只能基于文档内容生成问题** — 每个问题必须指向具体内容
2. **禁止凭空推测** — 不能因为"通常需要"或"最佳实践"而添加问题
3. **问题数量控制** — 与文档中不明确点数量相当，宁可少问不可乱问

详细澄清护栏规则见 `openspec/rules/clarification.md` §3。

---

## 错误处理

### 输入错误

| 错误场景                           | 处理方式                                                |
| ---------------------------------- | ------------------------------------------------------- |
| split-plan 文件不存在              | 报错：`split-plan 文件不存在: {path}`，提示用户检查路径 |
| split-plan JSON 格式无效           | 报错：`split-plan JSON 格式无效`，提示用户检查文件内容  |
| split-plan status 不是 `confirmed` | 报错并提示当前状态，引导用户先在可视化系统中确认        |
| split-plan groups 为空             | 报错：`split-plan 中没有任何分组`，提示用户检查拆分结果 |

### 执行错误

| 错误场景                  | 处理方式                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| 原始需求文件不可访问      | 报错：列出无法访问的文件路径，提示用户检查 `openspec/resources/` |
| change 目录已存在         | 跳过该组，在摘要中标注"已跳过"                                   |
| change 名称与现有目录冲突 | 自动追加数字后缀（-2, -3, ...）                                  |
| JSON 校验多次失败         | 在输出中说明无法修复的原因及最后一道报错信息                     |

### 状态错误

| 错误场景                         | 错误信息                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| status 为 `pending_confirmation` | `错误: split-plan 尚未确认（status: pending_confirmation）。请先在可视化系统中审查并确认拆分方案，将 status 更新为 confirmed 后再运行 /split-confirm。` |
| status 为 `completed`            | `错误: split-plan 已执行完成（status: completed），不允许重复执行。如需重新拆分，请重新运行 /split-clarify 生成新的 split-plan。`                       |
| status 为 `skipped`              | `错误: split-plan 已被跳过（status: skipped）。如需执行拆分，请重新运行 /split-clarify 生成新的 split-plan。`                                           |

---

## 下一步

change 创建完成后，对每个 change 独立推进后续流程：

1. **回答澄清问题**：可视化系统展示 `clarification-questions.json` → 用户填写 → 生成 `clarification-answers.json`
2. **生成需求确认文档**：`/clarify-confirm --change {changeName}`
3. **继续 OpenSpec 流程**：`/opsx:continue {changeName}`（proposal → specs → design → tasks）

每个 change 独立推进，互不阻塞。
