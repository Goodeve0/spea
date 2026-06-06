---
name: clarify
description: 分析需求内容，生成所有澄清问题的 JSON 列表。当需求文档存在模糊、缺失信息或需要决策点时，使用此技能生成澄清问题。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
  author: openspec
  version: "1.1"
  generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 需求澄清 - Step 1: 生成问题列表

分析需求内容，生成所有澄清问题的 JSON 列表。

**命令**: `/clarify [input] [--change <change-name>] [--mcp <mcp-tools>] [--files <file1,file2,...>]`

**输入**:
- 需求输入路径（文件夹或文件，可选，默认 `./requirements-input`）
- 变更名称（可选，用于指定输出到特定 change 目录）
- MCP 工具名列表（可选，用于获取领域知识）
- 指定文件列表（可选，用于只解析指定的文件，避免上下文超出）

**输出文件夹**: `requirements-clarification/`
**主入口文件**: `clarification-questions.json`
- 如果指定 `--change`: 输出到 `openspec/changes/{change-name}/requirements-clarification/`
- 否则: 输出到 `requirements-clarification/`

**特性**:
- 不进行任何交互，直接输出 JSON 文件
- 自动加载默认解析规则（全局 → 项目级 → 运行环境）
- 支持多种输入格式（文档、图片等）
- 支持分阶段调用 MCP 工具：预获取基础知识 + 解析过程中按需动态查询

---

## 命令用法

```bash
# 基础用法：指定需求输入文件夹
/clarify ./requirements-input

# 指定变更名称，输出到对应 changes 目录
/clarify ./requirements-input --change add-user-auth

# 指定 MCP 工具获取领域知识（按需，例如查询 OpenAI/Azure 文档）
/clarify ./requirements-input --change add-scenario-picker --mcp openai

# 指定多个 MCP 工具（逗号分隔）
/clarify ./requirements-input --mcp openai,azure-speech

# 指定具体文件（避免上下文超出）
/clarify --files ./prd.md,./design.png --change add-scenario-picker

# 组合使用：指定文件 + MCP 工具
/clarify --files ./prd.md --change add-scenario-picker --mcp openai
```

---

## 前置条件

如果指定了 `--change`:
- 检查 `openspec/changes/{change-name}/` 是否存在
- 如不存在，提示用户先运行 `openspec new change "{change-name}"`

---

## 输出目录结构

### 场景 1: 独立运行（不指定 --change）

```
requirements-clarification/
├── original-input/                # 原始需求备份
│   ├── *.md
│   ├── *.png
│   └── ...
└── clarification-questions.json   # 本技能输出
```

### 场景 2: 集成到 OpenSpec（指定 --change）

```
openspec/changes/{change-name}/
├── requirements-clarification/        # 输出文件夹
│   ├── clarification-questions.json   # 主入口文件
│   └── [未来可扩展其他分析产物]
├── proposal/
├── design/
└── tasks/
```

---

## 规则和模板引用

### 规则文件

澄清规则定义见：`openspec/rules/clarification.md`

包含：审计准则、触发词配置、数据源处理、提问技巧等。

**规则加载顺序**（后加载覆盖先加载）：
1. 内置默认规则
2. `openspec/rules/clarification.md`
3. `CLAUDE.md` 引入的 rules 或 `.cursor/rules/*.mdc`

### 输出模板

**⭐ 必须严格按模板输出**

| 输出 | 模板路径 |
|------|----------|
| 问题列表 | `openspec/schemas/trip-workflow/templates/clarification-questions.json` |
| 回答文件 | `openspec/schemas/trip-workflow/templates/clarification-answers.json` |

执行前必须读取模板文件，输出的 JSON 结构必须与模板完全一致。

---

## 执行流程

### 1. 解析参数

- 解析输入路径（文件夹或文件）
- 解析 `--change` 参数确定输出位置
- 解析 `--mcp` 参数确定调用的工具
- 解析 `--files` 参数确定要处理的文件列表

### 2. 检查变更目录（如果指定 --change）

验证 `openspec/changes/{change-name}/` 存在。

### 3. 读取输入文件

**⚠️ 禁止对目录路径调用 Read**：当输入为**文件夹路径**时，Read 工具会报错 `EISDIR: illegal operation on a directory`。必须先列出目录内容（如使用 List directory 或 `ls`），再对列出的**每个文件**调用 Read；不得对文件夹路径本身调用 Read。

**文件获取逻辑**：

| 参数情况 | 行为 |
|----------|------|
| 仅指定文件夹 | 先列出该目录下的文件，再对每个文件调用 Read（不要对文件夹路径调用 Read） |
| 仅指定 `--files` | 直接对每个文件路径调用 Read |
| 文件夹 + `--files` | 从文件夹中定位对应文件，对每个文件调用 Read |

**支持的文件类型**：
- 文本类：`.md`, `.txt`, `.pdf`
- 图片类：`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`

### 4. 加载规则

按优先级加载规则文件（见上文"规则加载顺序"）。

### 5. 检查增量模式

**自动检测** `clarification-questions.json` 是否存在：

| 问题文件 | 处理方式 |
|----------|----------|
| 不存在 | 首次生成 |
| 存在 | 增量模式：读取已有问题，去重后追加新问题，ID 从最大值 +1 开始 |

### 6. MCP 第一阶段：预获取基础知识（如指定 --mcp）

在解析需求之前，先建立对 MCP 工具能力的基础认知。

**必须执行**：
1. **了解工具能力**：调用帮助/文档接口，获取 MCP 工具的能力清单（支持哪些查询、返回什么信息）
2. **获取基础领域知识**：获取框架/平台的核心概念、组件清单、API 能力边界等基础信息
3. **建立术语映射**：将 MCP 返回的专有名词、组件名、API 名等整理为术语表，供后续解析时匹配

**⚠️ MCP 角色定位（必须遵守）**：
- MCP 是辅助 AI 理解需求文档中专业名词和概念的工具，**不是独立的需求来源**
- 需求的 `source` 字段必须指向实际的需求文档（文本、图片等），不能将 MCP 作为 source
- MCP 返回的信息用于帮助 AI 更准确地理解需求、判断可行性，但问题的来源仍然是原始需求文档
- 在 `metadata.mcpTools` 中记录使用了哪些 MCP 工具即可，无需在问题级别标注 MCP 来源

### 7. 读取输出模板

**必须步骤**：读取 `openspec/schemas/trip-workflow/templates/clarification-questions.json`

### 8. 需求解析与分类（含 MCP 动态查询）

从输入文件提取需求，按规则分类。

需求结构和问题结构见模板文件定义。

**默认值 (defaultValue)**: 生成问题时，应根据对需求的理解为每个问题设置合理的 `defaultValue`，作为 AI 推荐的答案参考。用户未回答时，confirm 阶段会自动使用默认值。

审计准则和触发词配置见 `openspec/rules/clarification.md`。

#### MCP 第二阶段：解析过程中按需查询术语（如指定 --mcp）

在解析需求内容时，遇到**无法理解的专有名词或领域术语**，应主动调用 MCP 进行名词解释，确保准确理解需求含义后再生成问题。

**触发条件**：需求文档中出现了第一阶段预获取知识未覆盖的专有名词（组件名、API 名、框架概念、项目黑话等）。

**查询原则**：
- 同一术语只查询一次，后续复用结果
- 查询结果用于辅助理解需求，不产生新的需求

### 9. 生成澄清问题

根据规则为每个需求点生成问题。

**⚠️ 零问题场景**：如果分析后没有需要澄清的问题，仍然**必须生成** `requirements-clarification/clarification-questions.json` 文件，`questions` 数组为空，`metadata.totalQuestions` 为 0。**禁止因为没有问题而跳过文件生成。**

### 10. 输出 JSON

**⛔ 强制要求**：无论任何情况，必须写入 `requirements-clarification/clarification-questions.json` 到目标位置。

- 字符串定界符仅使用 ASCII 双引号 `"`；内容内若有英文双引号须转义为 `\"`，反斜杠为 `\\`，换行/制表/回车为 `\n` / `\t` / `\r`。
- 不进行任何交互，直接输出文件。

### 11. 生成后校验与修正（⛔ 必做，不可跳过）

**目的**：确保产出的 `clarification-questions.json` 一定是合法 JSON，可被 `JSON.parse()` 正确解析。

**步骤（必须按顺序执行，直至通过）**：

1. **校验**  
   - 用 Read 工具读回刚写入的 `requirements-clarification/clarification-questions.json`。  
   - 用可用的校验手段判断是否为合法 JSON（例如：在变更目录下执行  
     `node -e "try{JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('OK')}catch(e){console.error(e.message);process.exit(1)}" "requirements-clarification/clarification-questions.json"`  
     若输出 `OK` 且退出码 0 则通过；否则为不通过）。  
   - 若无 node，则自行逐项检查：每个字符串是否用 `"` 成对包裹、键与值是否均为合法 JSON 类型、是否存在未转义的 `"` 或非法控制字符、数组/对象末尾是否有尾逗号等。

2. **不通过时修正**  
   - 根据校验报错或自检结果，定位并修正所有导致 JSON 无效的语法错误（例如：未闭合的 `"`、用 `「` 等当作字符串边界、未转义的 `"`、尾逗号、非法换行等）。  
   - 不穷举错误类型，以「修正后能被 JSON.parse 解析」为准。  
   - 将修正后的完整内容再次写入同一文件，覆盖原文件。

3. **重复**  
   - 再次执行步骤 1。若仍不通过，重复步骤 2 和 1，直到校验通过为止。

**结束条件**：校验通过后，本技能方可视为完成。若多次修正仍无法通过，在输出中说明无法修复的原因及最后一道报错信息。

---

## 护栏

### ⛔ 核心护栏

**所有问题必须有文档依据！**

1. **只能基于文档内容生成问题** - 每个问题必须指向具体内容
2. **禁止凭空推测** - 不能因为"通常需要"或"最佳实践"而添加问题
3. **问题数量控制** - 与文档中不明确点数量相当，宁可少问不可乱问
4. **⛔ 文件产物必须生成** - 无论问题数量多少（包括零个），`requirements-clarification/clarification-questions.json` 文件**必须写入**目标路径；且必须完成步骤 11（生成后校验与修正），直至 JSON 合法可解析，技能方可结束

### ⭐ 模板约束

1. **必须先读取模板**
2. **输出结构必须与模板一致**
3. **不得增减模板定义的字段**

详细护栏规则见 `openspec/rules/clarification.md` §3。

### 其他护栏

- 输入文件夹必须存在且包含有效文件
- `--change` 指定的变更必须存在
- 指定 MCP 工具时必须调用
- 保留原始需求，不修改用户输入

---

## 错误处理

### 输入文件夹不存在
```
错误: 输入文件夹不存在
路径: ./requirements-input
```

### 变更目录不存在
```
错误: 变更目录不存在
openspec/changes/{change-name}/
请先运行: openspec new change "{change-name}"
```

### 无有效输入文件
```
提示: 未找到有效的需求文件
请检查输入文件夹或指定的文件列表
```

---

## 下一步

问题列表生成后：
1. 可视化系统填写 → 生成 `clarification-answers.json`
2. 手动创建 `clarification-answers.json`

然后运行 `/clarify-confirm --change <name>` 生成确认文档。

如果是 OpenSpec 集成模式（指定了 --change）：
- 确认文档会生成到 `openspec/changes/{name}/requirements-clarification/`
- 后续 `/opsx:new` 或 `/opsx:continue` 会自动读取该文档
