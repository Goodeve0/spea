---
name: design-confirm
description: 根据用户回答将确认内容回填到 design.md，使其技术方案完整。在 design 生成同步产出问题并获取用户回答后，使用此技能将确认结果直接更新到 design.md 中。
license: MIT
compatibility: 与 OpenSpec 工作流集成
metadata:
  author: openspec
  version: "2.0"
  generatedBy: "1.0.0"
---

Base directory for this skill: {{SKILL_DIR}}

# 技术方案确认 - 回填 design.md

根据用户回答将确认内容回填到 design.md，使其技术方案完整。

**⚠️ 必选条件**: 当 `design-questions.json` 存在时，此步骤为**必选流程（REQUIRED）**，不可跳过。只有在 design 阶段没有产出任何澄清问题时，才可以跳过此步骤。

**命令**: `/design-confirm --change <change-name>`

**前置条件**:
- `design-clarification/` 文件夹存在
- 文件夹中包含 `design-questions.json` 和 `design-answers.json`

**输入文件夹**: `design-clarification/`（读取文件夹中的所有文件）
- `openspec/changes/{change-name}/design-clarification/`

**输出**: 更新后的 `design.md`
- `openspec/changes/{change-name}/design.md`

**特性**: 不进行任何交互，只读取文件并更新 design.md

---

## 命令用法

```bash
# 为指定变更将确认结果回填到 design.md
/design-confirm --change add-user-auth
```

---

## 前置条件

1. 变更目录存在: `openspec/changes/{change-name}/`
2. 问题文件存在: `design-clarification/design-questions.json`
3. 回答文件存在: `design-clarification/design-answers.json`

---

## 输入文件

```
openspec/changes/{change-name}/
├── design.md                          # 需要更新的目标文件
└── design-clarification/              # 输入文件夹（读取全部内容）
    ├── design-questions.json          # 问题列表（design 阶段同步产出）
    ├── design-answers.json            # 用户回答（需要提前准备）
    └── [其他可能的辅助文件]
```

---

## 回答文件格式 (design-answers.json)

回答文件格式定义见模板：`openspec/schemas/trip-workflow/templates/design-answers.json`

**回答值格式**:
| inputType | value 类型 | 示例 |
|-----------|-----------|------|
| `SINGLE_SELECT` | string | `"A"` |
| `MULTI_SELECT` | string[] | `["A", "B"]` |
| `FREE_TEXT` | string | `"详细描述..."` |
| `CONFIRM` | boolean | `true` |
| `CODE_REVIEW` | boolean | `true`（表示批准） |

### 补充说明字段 (supplement)

对于 `SINGLE_SELECT`、`MULTI_SELECT`、`CONFIRM` 和 `CODE_REVIEW` 类型的问题，用户可以在答案中提供 `supplement` 字段来补充说明。

---

## 执行流程

### 1. 解析参数

- 解析 `--change` 参数确定输入/输出位置
- 验证变更目录存在

### 2. 加载规则

按照优先级加载规则文件：
1. 内置默认规则
2. `openspec/rules/design-clarification.md`
3. 变更级规则（如存在）

### 3. 读取并验证

1. 读取 `design-clarification/design-questions.json`
2. 读取 `design-clarification/design-answers.json`
3. 对于未回答的问题，如果问题有 `defaultValue`，自动使用默认值作为答案
4. 验证答案格式正确（类型匹配）

**未回答问题的处理**:
- 如果问题有 `defaultValue`，使用默认值
- 如果问题没有 `defaultValue` 且未回答，在回填时标注为"未确认"

### 4. 合并结果

将问题和回答合并：
- 根据 `questionId` 匹配问题和答案
- 将选项 ID 转换为实际标签
- 构建每个改动点的确认结果

### 5. 读取并更新 design.md

**核心步骤**: 根据每个问题的 `designRef` 和 `changeId` 定位 design.md 中的对应位置，将确认结果回填：

- 更新技术决策中不确定的方案为确认后的方案
- 将 `🤔 待讨论` 状态更新为 `✅ 已确认`
- 补充确认后的实现细节（如复用方案、组件选择等）
- 更新修改清单中的风险等级（如有调整）
- 如果用户提供了 supplement 补充说明，整合到对应位置

### 6. 保存更新后的 design.md

将更新后的内容保存回 `design.md`，覆盖原文件。

---

## 回填规则

### 整合确认结果

将问题的回答整合到 design.md 的对应位置，而不是生成单独的确认文档。

**示例**:

原始 design.md 中的决策：
```markdown
### 决策 3: 认证方式
**状态**: 🤔 待讨论
**方案**: JWT 或 Session，需确认
```

澄清回答: "A" (JWT)，supplement: "支持多端无状态登录"

**回填后的 design.md**:
```markdown
### 决策 3: 认证方式
**状态**: ✅ 已确认
**方案**: JWT（已确认，原因：支持多端无状态登录）
```

### 风险等级更新

根据用户确认更新风险状态：
- 用户确认接受风险 → 标记为 "已知风险，已确认"
- 用户提供缓解措施 → 更新缓解措施列表

### 代码审查结果

对于 CODE_REVIEW 类型的确认：
- 批准 → 保留原代码
- 有建议 → 在代码注释中标注建议
- 有修改 → 更新代码片段

---

## OpenSpec 集成

### 后续流程

design.md 更新完成后，后续阶段直接读取 design.md：

1. **tasks.md 生成**: 直接读取 design.md（已是完整版本）
2. **apply 阶段**: 按 design.md 中的技术方案实现

---

## 错误处理

### 缺少问题文件
```
错误: design-questions.json 不存在
位置: openspec/changes/{change-name}/design-clarification/
请先运行 /opsx:continue {change-name} 生成设计文档（会同步产出问题）
或运行 /design-clarify --change {change-name} 补充问题
```

### 缺少回答文件
```
错误: design-answers.json 不存在
位置: openspec/changes/{change-name}/design-clarification/
请通过可视化系统或手动创建回答文件
```

### 回答格式错误
```
错误: 以下回答格式不正确:
- DQ-002: 期望数组，实际为字符串
- DQ-004: 期望布尔值，实际为字符串

请修正后重试
```

---

## 护栏

### 基础护栏

- **只读取文件，不进行任何交互**
- **验证答案格式正确**
- **未回答的问题使用 defaultValue 作为默认答案**
- **--change 指定的变更必须存在**
- **保持问题和回答的对应关系**
- **必须遵循项目规则** - 按照 `openspec/rules/design-clarification.md` 中定义的规则回填

### 回填约束

1. **保持 design.md 结构不变** - 只更新对应位置的内容，不改变文档整体结构
2. **不删除已有内容** - 只更新不确定的部分，已确定的内容保持不变
3. **标注回填来源** - 可选：在更新的内容旁标注关联的问题 ID（如 `<!-- DQ-001 -->`）
