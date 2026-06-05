## ADDED Requirements

### Requirement: 会话报告持久化

每次生成会话报告时，系统 SHALL 将一条会话记录持久化到浏览器本地存储（IndexedDB 优先，localStorage 兜底），记录至少包含 `id`、`timestamp`、`scenarioId`、`difficulty`、`radar`（5 维分数）、`overallScore`。持久化 MUST NOT 依赖账号体系（遵循本期范围边界：本地匿名）。

#### Scenario: 报告生成即落库
- **WHEN** 一次会话生成报告成功
- **THEN** 本地存储新增一条可按 `timestamp` 检索的会话记录

#### Scenario: 存储失败不阻断
- **WHEN** 本地存储写入失败（如隐私模式）
- **THEN** 报告仍正常展示，仅成长曲线提示"本次无法保存历史"

### Requirement: 历史会话检索

系统 SHALL 提供按时间倒序检索历史会话记录的能力，供首页状态栏与报告页成长曲线消费。

#### Scenario: 首页展示真实数据
- **WHEN** 存在历史会话记录
- **THEN** 首页顶部状态栏的连续练习天数（streak）与累计经验（XP）基于真实历史计算，而非写死占位值

### Requirement: 成长曲线

报告页 SHALL 展示 5 维能力（发音、流利、语法、词汇、任务完成度）随历史会话变化的成长曲线。曲线组件 SHOULD 懒加载以控制首屏体积。

#### Scenario: 多次会话后展示趋势
- **WHEN** 用户已完成 ≥ 2 次会话
- **THEN** 报告页展示各维度随时间的折线趋势

#### Scenario: 历史不足的空态
- **WHEN** 用户仅完成 1 次会话（无历史可对比）
- **THEN** 成长曲线区展示引导空态（如"再练一次就能看到你的成长曲线啦"），MUST NOT 报错或白屏

### Requirement: CEFR 等级估算

报告 SHOULD 基于综合表现给出近似 CEFR 等级（A1–C2）作为锚点，并明确标注为"估算"，避免误导为权威认证。

#### Scenario: 展示估算等级
- **WHEN** 报告生成完成
- **THEN** 展示形如 "≈ B1（估算）" 的等级标签
