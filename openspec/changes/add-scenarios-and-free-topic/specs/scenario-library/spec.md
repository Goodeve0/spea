## ADDED Requirements

### Requirement: 结构化场景库

系统 SHALL 提供 ≥ 9 个预设场景，每个场景带 `category`（分类）与 `difficulty`。分类至少覆盖职场、生活、出行、社交、考试中的多个。

#### Scenario: 按分类展示
- **WHEN** 用户打开首页
- **THEN** 场景按分类分组展示，每个场景显示标题、描述、目标与难度

#### Scenario: 契约向后兼容
- **WHEN** 既有代码读取 `Scenario`
- **THEN** 新增的 `category` 为可选字段，不破坏既有消费方

### Requirement: 随机场景

系统 SHALL 提供"随机场景"入口，随机选择一个场景（可随机难度）直接开练。

#### Scenario: 随机开练
- **WHEN** 用户点击随机场景
- **THEN** 系统随机挑选一个场景并进入对话页
