## ADDED Requirements

### Requirement: 纠错附带原因

报告中的每一条语法纠错（correction）SHALL 附带一个非空的 `why` 字段，用口语化中文解释"为什么这样改"，而不仅给出"原句 → 改句"。

#### Scenario: 纠错展示原因
- **WHEN** 报告包含一条把 "borrow" 改为 "lend" 的纠错
- **THEN** 该条同时展示原因解释（如"你是借出方，借出用 lend；borrow 是借入"）

#### Scenario: 缺失原因兜底
- **WHEN** LLM 未返回某条纠错的 `why`
- **THEN** report-generator MUST 填入安全默认值（如"更符合英语母语者的自然表达"），保证字段非空、界面不缺块

### Requirement: 表达升级附带原因

报告中的每一条表达升级（expression upgrade，"你说的" → "更地道的"）SHALL 附带 `why`，说明升级版本更地道/更得体的原因。

#### Scenario: 升级展示原因
- **WHEN** 报告把 "I want to know..." 升级为 "I'd love to learn..."
- **THEN** 同时说明原因（如"更礼貌、更显热情，面试场景更得体"）

### Requirement: 解释面向中文学习者

所有 `why` 解释 MUST 使用口语化简体中文，避免语言学术语堆砌，确保有一定英语基础但非专业的学习者能看懂。

#### Scenario: 通俗解释
- **WHEN** 生成任一 `why` 文本
- **THEN** 文本为通俗中文，不出现未经解释的专业术语
