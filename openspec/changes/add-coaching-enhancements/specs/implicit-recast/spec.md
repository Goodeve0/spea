## ADDED Requirements

### Requirement: 对话中隐性重述

当用户表达出现"沟通阻断级"或明显语法/用词错误时，AI SHALL 在保持角色与对话连贯的前提下，以自然重述（recast）的方式隐性纠正——即在自己的回复里用正确说法复述一遍用户的意思，而非显式指出错误。此过程 MUST NOT 弹窗，MUST NOT 打断对话节奏。

#### Scenario: AI 自然重述
- **WHEN** 用户说出 "I very like this job"
- **THEN** AI 回复中自然包含正确说法（如 "I'm glad you really like this job — what excites you most about it?"），不显式标注错误

#### Scenario: 表达正确时不重述
- **WHEN** 用户表达无明显错误
- **THEN** AI 正常回应，不强行制造 recast

### Requirement: 重述记录结构化

每次发生隐性重述时，系统 SHALL 记录一条结构化 recast，至少包含 `turnId`（对应用户轮次）、`original`（用户原话）、`recast`（更地道/正确的说法）。这些记录 MUST 随会话保存，供报告回放使用。

#### Scenario: 记录被保存
- **WHEN** 一轮对话发生了隐性重述
- **THEN** 会话数据中新增一条含 `original` 与 `recast` 的记录

### Requirement: 报告中重述回放

报告页 SHALL 提供"重述回放"区，以 **"你说的" → "我帮你顺的"** 的对照形式展示本次会话所有 recast；无 recast 时展示正向空态（如"本次没有需要顺的表达，很棒！"）。

#### Scenario: 展示对照回放
- **WHEN** 会话存在 ≥ 1 条 recast
- **THEN** 报告页逐条展示原话与重述版本的对照

#### Scenario: 无重述空态
- **WHEN** 会话不含任何 recast
- **THEN** 报告页展示正向鼓励空态，不显示空白区块
