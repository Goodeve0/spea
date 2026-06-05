---
name: split-clarify
description: 分析需求内容，提取需求条目，生成拆分计划（split-plan JSON）并中断执行。需求量 ≤ 阈值时生成单组 split-plan，超过阈值时执行三维度关联分析生成多组 split-plan。始终中断，由 /split-confirm 负责确认拆分方案、创建 change 并生成澄清问题。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
    author: openspec
    version: "2.0"
    generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 需求拆分计划生成

分析需求内容，提取需求条目，始终生成 split-plan JSON 并中断执行，等待用户通过可视化系统确认后由 `/split-confirm` 创建 change 并生成澄清问题。

**命令**: `/split-clarify <input-files-or-folder> [--name-prefix <prefix>] [--mcp <tools>] [--files <file1,file2,...>]`

**输入**:

- 需求输入路径（文件夹或文件，可选，默认 `./resource`）
- 名称前缀（可选，用于给生成的 split-plan 文件名和 changeName 添加统一前缀）
- MCP 工具名列表（可选，用于获取领域知识）
- 指定文件列表（可选，用于只解析指定的文件，避免上下文超出）

**输出**:

- 始终生成 `split-plan JSON` 到 `openspec/split-plans/`（status: `pending_confirmation`）
    - 需求数 ≤ 阈值：单组 split-plan（所有需求归入一组，跳过三维度分析）
    - 需求数 > 阈值：多组 split-plan（三维度关联分析后聚类分组）
- **始终在生成 split-plan 后中断，不生成澄清问题**

**特性**:

- 自动加载拆分规则
- 支持多种输入格式（文档、图片等）
- 支持分阶段调用 MCP 工具：预获取基础知识 + 解析过程中按需动态查询

---

## 命令用法

```bash
# 基础用法：指定需求输入文件夹
/split-clarify ./resource

# 指定名称前缀（split-plan 和 changeName 都会加前缀）
/split-clarify ./resource --name-prefix myproject

# 指定 MCP 工具获取领域知识（按需，例如查询 OpenAI/Azure 文档）
/split-clarify ./resource --mcp openai

# 指定多个 MCP 工具（逗号分隔）
/split-clarify ./resource --mcp openai,azure-speech

# 指定具体文件（避免上下文超出）
/split-clarify --files ./prd.md,./design.png

# 组合使用：名称前缀 + MCP 工具
/split-clarify ./resource --name-prefix spea --mcp openai

# 组合使用：指定文件 + MCP 工具
/split-clarify --files ./prd.md --mcp openai
```

---

## 输出目录结构

`/split-clarify` 始终仅生成 split-plan，change 目录由 `/split-confirm` 在确认后创建。

```
openspec/
├── resources/                              # 原始需求输入（与 changes 平级）
│   ├── prd-xxx.md
│   └── ...
└── split-plans/                            # 拆分计划（/split-clarify 输出）
    └── {namePrefix}-split-{timestamp}.json  # 本次拆分计划（status: pending_confirmation）
```

确认后由 `/split-confirm` 创建：

```
openspec/changes/                           # /split-confirm 创建的独立 change
├── {namePrefix}-{change-name-1}/
│   ├── resources/
│   │   └── {namePrefix}-requirements.md
│   └── requirements-clarification/
│       └── {namePrefix}-clarification-questions.json
├── {namePrefix}-{change-name-2}/
│   ├── resources/
│   │   └── {namePrefix}-requirements.md
│   └── requirements-clarification/
│       └── {namePrefix}-clarification-questions.json
└── ...
```

---

## 规则和模板引用

### 拆分规则文件

拆分规则定义见：`openspec/rules/splitting.md`

包含：拆分阈值、维度权重、分组策略、关联信号识别、自定义维度扩展。

### 大文件写入规则

大文件分段写入规范见：`openspec/rules/file-writing.md`

包含：写入策略选择（Shell 原子写入 / 分段追加写入）、JSON 分段方案、写入后校验。

### 需求覆盖率验证规则

需求覆盖率验证规范见：`openspec/rules/requirement-coverage.md`

包含：两阶段提取策略（索引提取 + 逐条完整提取）、覆盖率交叉比对验证、content 压缩检测、大文档分批处理。

**规则加载顺序**（后加载覆盖先加载）：

1. 内置默认规则（硬编码在本 skill 中）
2. `openspec/rules/splitting.md`（项目级覆盖）

**内置默认值**：

| 配置项                     | 默认值 |
| -------------------------- | ------ |
| splitThreshold             | 5      |
| maxGroupSize               | 8      |
| dimensionWeights.technical | 0.33   |
| dimensionWeights.scope     | 0.33   |
| dimensionWeights.business  | 0.34   |
| minCorrelationScore        | 0.3    |

### 输出模板

**⭐ 必须严格按模板输出**

| 输出     | 模板路径                                                               |
| -------- | ---------------------------------------------------------------------- |
| 拆分计划 | `openspec/schemas/trip-workflow/templates/requirement-split-plan.json` |

执行前必须读取模板文件，输出的 JSON 结构必须与模板完全一致。

---

## 执行流程

### 1. 解析参数

- 解析输入路径（文件夹或文件）
- 解析 `--name-prefix` 参数确定名称前缀（影响所有产物文件名：split-plan、changeName）
- 解析 `--mcp` 参数确定调用的工具
- 解析 `--files` 参数确定要处理的文件列表

### 2. 将原始需求文档复制到 openspec/resources/

如果输入文件尚未存在于 `openspec/resources/`，将其复制过去。`openspec/resources/` 是所有原始需求输入的统一存放位置，与 `openspec/changes/` 平级。

### 3. 加载拆分规则

按优先级加载拆分规则：

1. 内置默认规则（splitThreshold=5, maxGroupSize=8, 三维度等权重, minCorrelationScore=0.3）
2. `openspec/rules/splitting.md`（如存在，覆盖对应配置项）

如果 `splitting.md` 不存在或配置项格式错误，使用内置默认值并输出警告。

### 4. 读取输入文件

**⚠️ 禁止对目录路径调用 Read**：当输入为**文件夹路径**时，Read 工具会报错 `EISDIR: illegal operation on a directory`。必须先列出目录内容（如使用 List directory 或 `ls`），再对列出的**每个文件**调用 Read；不得对文件夹路径本身调用 Read。

**文件获取逻辑**：

| 参数情况           | 行为                                        |
| ------------------ | ------------------------------------------- |
| 仅指定文件夹       | 先列出该目录下的文件，再对每个文件调用 Read |
| 仅指定 `--files`   | 直接对每个文件路径调用 Read                 |
| 文件夹 + `--files` | 从文件夹中定位对应文件，对每个文件调用 Read |

**支持的文件类型**：

- 文本类：`.md`, `.txt`, `.pdf`
- 图片类：`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`

### 5. MCP 第一阶段：预获取基础知识（如指定 --mcp）

在解析需求之前，先建立对 MCP 工具能力的基础认知。

**必须执行**：

1. **了解工具能力**：调用帮助/文档接口，获取 MCP 工具的能力清单
2. **获取基础领域知识**：获取框架/平台的核心概念、组件清单、API 能力边界等
3. **建立术语映射**：将 MCP 返回的专有名词整理为术语表，供后续解析时匹配

**⚠️ MCP 角色定位（必须遵守）**：

- MCP 是辅助 AI 理解需求文档中专业名词和概念的工具，**不是独立的需求来源**
- 需求的 `source` 字段必须指向实际的需求文档（文本、图片等），不能将 MCP 作为 source
- MCP 返回的信息用于帮助 AI 更准确地理解需求、判断可行性
- 在 `metadata.mcpTools` 中记录使用了哪些 MCP 工具即可

### 6. 读取输出模板

**必须步骤**：

- 读取 `openspec/schemas/trip-workflow/templates/requirement-split-plan.json`

### 7. 提取需求条目（两阶段提取 + 覆盖率验证）

需求提取采用两阶段策略，确保覆盖率和 content 完整度。详细规则见 `openspec/rules/requirement-coverage.md`。

#### 7a. 第一阶段：结构化索引提取

按 `openspec/rules/requirement-coverage.md §1.1` 扫描原始文档，生成需求索引清单（输出到聊天中，不写入文件）。**不合并相似需求点**。

#### 7b. 第二阶段：逐条完整提取

基于索引清单，为每个需求点分配唯一 ID（格式：`REQ-{N}`），并逐条提取完整 content。

提取时记录每个条目的：

- ID（`REQ-{N}`）
- 标题
- 详细描述（**完整提取**，见下方 content 字段要求）
- 来源文件和章节位置
- 关联图片列表

#### 7c. 覆盖率验证（⛔ 必做，不可跳过）

将索引清单与 REQ 列表交叉比对，输出覆盖率验证报告。**覆盖率必须 100%，不允许遗漏。content 疑似压缩的条目必须重新提取。** 验证不通过时不允许进入步骤 8。

**`content` 字段要求（⛔ 必须遵守）**：

`content` 必须包含该需求条目在原始文档中的**完整详细描述**，不做压缩或摘要。包括但不限于：

- 业务背景和目标
- 详细的功能描述和交互说明
- 边界条件和异常场景
- 数据格式和校验规则
- 与其他需求的关联说明

**⚠️ 禁止只写标题或一句话摘要**。`content` 是后续 `/split-confirm` 和 `/clarify-confirm` 生成澄清问题和确认文档的唯一数据源，信息丢失将导致最终文档不完整。

**`images` 字段要求**：

`images` 数组记录该需求条目关联的图片文件名（仅文件名，不含路径）。识别逻辑：

- 检查原始需求文档中该条目附近是否引用了图片（Markdown `![](...)` 或 HTML `<img>`）
- 检查 `source` 字段对应的文档区域是否包含图片引用
- 如果该条目来自图片文件（如 UI 设计图），将该图片文件名加入 `images`
- 无关联图片时为空数组 `[]`

**`source` 字段格式规范**：

`source` 字段必须以实际文件名（含扩展名）开头，格式为 `"{filename} - {章节或描述}"`。

| 来源类型      | 正确示例                             | 错误示例             |
| ------------- | ------------------------------------ | -------------------- |
| Markdown 文档 | `"prd.md - 第3章用户登录"`           | `"需求文档 - 第3章"` |
| 图片文件      | `"design.png - 首页UI布局"`          | `"UI设计图 - 首页"`  |
| 文本文件      | `"requirements.txt - 功能列表第5条"` | `"功能列表第5条"`    |
| PDF 文件      | `"spec.pdf - 第2页交互说明"`         | `"交互说明"`         |

**⚠️ 此格式为强制要求**：`split-confirm` 在复制图片资源时依赖 `source` 字段中的文件名进行匹配，格式不符将导致图片无法精确关联到对应 change。

### 8. 判断分组策略

**阈值判断逻辑**：

```
IF 需求条目总数 ≤ splitThreshold:
    → 单组模式：跳过三维度分析，所有需求归入一组（步骤 9 直接执行 9.3）
ELSE:
    → 多组模式：执行三维度关联分析（步骤 9.1 → 9.2 → 9.3）
```

**⚠️ 无论哪种模式，都继续执行步骤 9，生成 split-plan。**

---

### 9. 构建分组并生成 Split_Plan JSON

#### 9.1 三维度分析算法（仅在需求数 > splitThreshold 时执行）

按 `openspec/rules/splitting.md §3` 对所有需求条目进行三维度关联分析（技术实现、修改范围、业务关联性），识别各维度的关联信号。

#### 9.2 关联分数计算与贪心聚类（仅在需求数 > splitThreshold 时执行）

按 `openspec/rules/splitting.md §4` 执行关联分数计算（三维度加权求和）和贪心聚类。综合关联分数低于 `minCorrelationScore`（默认 0.3）的需求条目作为独立的 Requirement_Group。

#### 9.3 为每个组生成标识和名称

- 组标识：`RG-{N}`，N 从 1 开始递增，所有 ID 互不相同
- 组名称：中文描述，概括该组需求的核心主题

#### 9.4 Change 名称生成策略

为每个 Requirement_Group 生成 change 目录名称：

| 规则   | 说明                                                 | 示例                                             |
| ------ | ---------------------------------------------------- | ------------------------------------------------ |
| 格式   | kebab-case，全小写                                   | `user-auth-module`                               |
| 前缀   | 如指定 `--name-prefix`，在名称前添加 `{namePrefix}-` | `myproject-user-auth-module`                     |
| 长度   | 2-5 个单词（不含前缀），不超过 40 字符（不含前缀）   | `order-list-search`                              |
| 来源   | 从组内需求的核心业务关键词提取                       | 需求涉及"登录、注册、Token" → `user-auth-module` |
| 唯一性 | 不能与现有 `openspec/changes/` 下的目录名冲突        | 冲突时追加数字后缀：`user-auth-module-2`         |

**生成算法**：

```
generateChangeName(group: RequirementGroup, namePrefix?: string) → string:
  1. 从 group.requirements 中提取高频业务关键词
  2. 结合 group.name 和 group.description 提炼核心主题
  3. 转换为 kebab-case 格式（全小写，单词间用连字符连接）
  4. 确保长度 2-5 个单词，不超过 40 字符
  5. 如果指定了 namePrefix，在名称前添加 `{namePrefix}-`
  6. 检查 openspec/changes/ 下是否已存在同名目录
  7. 如冲突，追加数字后缀（-2, -3, ...）
  8. 返回最终名称
```

#### 9.5 生成 Split_Plan JSON

生成拆分计划文件到 `openspec/split-plans/`。

**文件命名规则**：`{namePrefix}-split-{timestamp}.json`（有前缀时）或 `split-{timestamp}.json`（无前缀时）

- `{namePrefix}`: 由 `--name-prefix` 参数指定，可选
- `{timestamp}`: 格式 `YYYYMMDD`，如 `20260311`
- **不得在日期后再追加主题或描述性后缀**（如 `-trip-spec`）；主题信息保留在 JSON 内的 `groups` / `metadata` 即可
- 完整示例（有前缀）：`myproject-split-20260311.json`
- 完整示例（无前缀）：`split-20260311.json`

**存放位置**：`openspec/split-plans/` 目录（如不存在则创建）

**结构**：严格按照 `openspec/schemas/trip-workflow/templates/requirement-split-plan.json` 模板输出。

**⚠️ 大文件写入**：split-plan JSON 在 groups 较多时（≥ 3 组）可能超出单次写入限制。**必须遵循 `openspec/rules/file-writing.md` 中的大文件分段写入规范**，优先使用 Shell 原子写入（策略 A），不可用时使用分段追加写入（策略 B）。

Split_Plan 包含：

- `metadata`: version、generatedAt（ISO 8601）、projectName、sourceFiles、splitThreshold、totalRequirements、totalGroups、namePrefix（如指定）、status（`pending_confirmation`）、confirmedAt（null）、skipReason（null）、**executionPlan**（含 totalPhases、phases 数组）
- `groups` 数组：每个元素含 id（`RG-{N}`）、name、changeName（已含 namePrefix 前缀）、description、**executionPhase**（执行阶段编号）、requirements（**每项必须含** id、title、**content**、source、**images**）、splitReason（含 primaryDimension/description）、dependencies（依赖的其他组 ID 列表）、dependencyChanges（依赖的其他组对应的 change 名称列表）

**⚠️ 关键**：`metadata.status` 始终为 `pending_confirmation`，无论需求数量多少。`metadata.skipReason` 始终为 `null`。

#### 9.6 指定执行顺序（⛔ 必做，不可跳过）

按 `openspec/rules/splitting.md §6` 为每个组指定执行阶段。**即使只有单组（需求数 ≤ splitThreshold），也必须执行此步骤**（单组场景下 executionPhase=1、phases 只有一个元素）。

**步骤**：

1. **判断依赖关系**：根据每个 group 的 `dependencies`，结合对需求内容的理解，确定组间先后关系
2. **指定执行阶段**：无依赖的组 → Phase 1；依赖其他组的组 → Phase 大于所有依赖组的 Phase；前后端配对时后端 Phase ≤ 前端 Phase
3. **写入 split-plan**：
    - 每个 group 写入 `executionPhase`
    - `metadata.executionPlan` 写入 `totalPhases`、`phases`（每阶段含 phase 编号、groups ID 列表、description）

#### 9.7 输出拆分摘要

生成 split-plan 后，输出拆分摘要：

```
📋 需求拆分摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总需求数: {N}  |  拆分为: {M} 组  |  阈值: {threshold}  |  执行阶段: {P} 个

┌──────┬──────────────────┬──────┬────────┬───────────┐
│ 组   │ 名称             │ 需求 │ 阶段   │ 依赖      │
├──────┼──────────────────┼──────┼────────┼───────────┤
│ RG-1 │ {组名称}         │ {N}  │ ① P1   │ {或"无"}  │
│ RG-2 │ {组名称}         │ {N}  │ ① P1   │ {或"无"}  │
│ ...  │ ...              │ ...  │ ...    │ ...       │
└──────┴──────────────────┴──────┴────────┴───────────┘

📌 Phase 1 可立即并行启动，Phase 2 待 Phase 1 完成后开始

拆分计划已保存: openspec/split-plans/{filename}.json
```

#### 9.8 JSON 校验与修正（⛔ 必做，不可跳过）

对生成的 `split-plan JSON` 执行校验与修正。

**步骤（必须按顺序执行，直至通过）**：

1. **校验**

    - 用 Read 工具读回刚写入的 split-plan 文件。
    - 用可用的校验手段判断是否为合法 JSON（例如：执行
      `node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('OK')}catch(e){console.error(e.message);process.exit(1)}" "openspec/split-plans/{filename}.json"`
      若输出 `OK` 且退出码 0 则通过）。
    - 若无 node，则自行逐项检查：每个字符串是否用 `"` 成对包裹、键与值是否均为合法 JSON 类型、是否存在未转义的 `"` 或非法控制字符、数组/对象末尾是否有尾逗号等。
    - **语义校验**：每个 `groups[].requirements[]` 对象必须包含键 `content`（非空字符串，trim 后长度 > 0）与 `images`（数组，无图时为 `[]`）；缺失或 `content` 仅为标题级占位视为不通过，须补全。
    - **执行顺序校验**：每个 `groups[]` 必须包含 `executionPhase`（正整数）；`metadata.executionPlan` 必须包含 `totalPhases`、`phases` 且 phases 覆盖所有组。

2. **不通过时修正**

    - 根据校验报错或自检结果，定位并修正所有导致 JSON 无效或语义不合格的项。
    - 将修正后的完整内容再次写入同一文件，覆盖原文件。

3. **重复**
    - 再次执行步骤 1。若仍不通过，重复步骤 2 和 1，直到校验通过为止。

**结束条件**：校验通过后，本流程方可视为完成。

#### 9.9 回写拆分计划文件名到 metadata.json

将生成的 split-plan 文件名回写到需求目录的 `metadata.json` 中。

**执行步骤**：

1. **确定需求目录**：从输入路径提取需求目录（如输入为 `openspec/resources/airport-booking`，则需求目录为该路径）

2. **读取现有 metadata.json**：

    - 读取 `openspec/resources/{name}/metadata.json`
    - 如文件不存在，创建空对象

3. **更新 splitPlan 字段**：

    - 添加/更新 `splitPlan` 字段为生成的 split-plan 文件名（仅文件名，如 `airport-booking-split-20260316.json`）
    - 更新 `updatedAt` 字段为当前时间（ISO 8601 格式）

4. **保存 metadata.json**

**示例**：

```json
{
    "name": "airport-booking",
    "larkUrls": ["https://trip.larkenterprise.com/wiki/xxx"],
    "splitPlan": "airport-booking-split-20260316.json",
    "createdAt": "2026-03-16T14:48:32.698Z",
    "updatedAt": "2026-03-16T15:30:00.000Z"
}
```

#### 9.10 ⚠️ 中断点：等待用户确认拆分方案

**`/split-clarify` 在此处结束执行。** split-plan 已生成并保存，等待用户通过可视化系统确认。

**当前状态**:

```
openspec/split-plans/
└── {namePrefix}-split-{timestamp}.json    ✓ 已生成（status: pending_confirmation）
```

**可视化系统操作**:

1. Web UI 展示 split-plan JSON 中的分组信息
2. 用户审查拆分方案，可进行调整（合并/移动/拆分组）
3. 用户确认后，可视化系统直接更新 split-plan 的 `metadata.status` 为 `confirmed`（如有调整，同步修改 `groups` 中的分组内容）
4. 执行 `/split-confirm` 命令，读取已确认的 split-plan，创建 change 并生成澄清问题

**用户可执行的操作**（通过可视化系统直接修改 split-plan）：

| 操作           | 说明                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------- |
| **直接确认**   | 接受当前拆分方案，更新 `metadata.status` 为 `confirmed`                                   |
| **调整后确认** | 在可视化系统中合并/移动/拆分组，修改 `groups` 内容后更新 `metadata.status` 为 `confirmed` |
| **跳过拆分**   | 放弃拆分，更新 `metadata.status` 为 `skipped`，所有需求作为单个组处理                     |

**下一步命令**:

```bash
# 用户在可视化系统确认后执行
/split-confirm openspec/split-plans/{filename}.json
```

**⚠️ 重要**：`/split-clarify` 不执行 change 创建和澄清问题生成。这些操作由 `/split-confirm` 负责。

---

## 护栏

### ⭐ 模板约束

1. **必须先读取拆分计划模板**（`requirement-split-plan.json`）
2. **输出结构必须与模板一致**：`requirements[]` 每条必须包含模板中的全部键（`id`、`title`、`content`、`source`、`images`），与 §7 及 `requirement-coverage.md` 一致
3. **不得删除模板已定义的键名**；禁止省略 `content`/`images` 或仅用标题充当 `content`。扩展字段须与模板及消费端约定一致

### 拆分护栏

1. **需求守恒** - 拆分后所有组的需求条目并集必须等于输入的需求条目集合，不允许丢失或重复。**必须通过 `openspec/rules/requirement-coverage.md` 中的覆盖率验证（100%）才能生成 split-plan**
2. **content 完整度** - 每个 REQ 的 content 必须包含原始文档中该需求点的完整详细描述，禁止压缩为标题或一句话摘要。详见 `openspec/rules/requirement-coverage.md` §2.2
3. **组标识唯一** - 每个组的 `id`（`RG-{N}`）和 `changeName` 必须互不相同
4. **阈值决定分组策略** - 条目数 ≤ splitThreshold 时跳过三维度分析、生成单组；超过阈值时执行三维度分析、生成多组。**两种情况均生成 split-plan 并中断**
5. **组大小限制** - 每组不超过 `maxGroupSize`，超过时尝试进一步拆分
6. **依赖完整** - 组间依赖关系必须在 `dependencies` 和 `dependencyChanges` 中正确记录
7. **split-plan 结构** - 严格按照模板输出，`metadata.status` 始终为 `pending_confirmation`，`metadata.skipReason` 始终为 `null`
8. **⛔ 禁止生成澄清问题** - 本技能不生成 `clarification-questions.json`，该职责属于 `/split-confirm`

### 其他护栏

- 输入文件夹必须存在且包含有效文件
- 指定 MCP 工具时必须调用
- 保留原始需求，不修改用户输入

---

## 错误处理

### 输入错误

| 错误场景                      | 处理方式                                         |
| ----------------------------- | ------------------------------------------------ |
| 输入文件夹为空或不存在        | 报错提示用户提供需求文档                         |
| 需求文档格式无法解析          | 跳过该文件，在 split-plan 的 metadata 中记录警告 |
| `splitting.md` 配置项格式错误 | 使用内置默认值，输出警告                         |
| 无有效输入文件                | 提示用户检查输入文件夹或指定的文件列表           |

### 拆分错误

| 错误场景                    | 处理方式                                           |
| --------------------------- | -------------------------------------------------- |
| 无法提取任何需求条目        | 生成空 split-plan（groups 为空），提示用户检查输入 |
| 拆分后某组超过 maxGroupSize | 尝试进一步拆分；无法拆分则保留并标注               |
| 循环依赖                    | 合并存在循环依赖的组                               |
| change 名称冲突             | 自动追加数字后缀（-2, -3, ...）                    |

---

## 下一步

split-plan 生成后，需要用户/可视化系统确认拆分方案：

1. **查看拆分计划**：Web UI 展示 split-plan JSON 内容
2. **确认或调整**：用户在可视化界面上确认/合并/移动/拆分/跳过
3. **执行拆分确认**：运行 `/split-confirm <split-plan-file>` 创建 change 并生成澄清问题
4. **回答澄清问题**：对每个 change 回答 `clarification-questions.json`
5. **继续流程**：对每个 change 运行 `/requirements-confirm --change {change-name}` → `/opsx:continue {change-name}`

每个 change 独立推进，互不阻塞。
