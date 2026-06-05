## Why

竞品调研（Speak / ELSA / Duolingo 等）显示，AI 口语产品同质化在"能聊 + 能纠错"，真正拉开差距的是三件事，且恰好命中本产品 PRD 的三大痛点：

1. **降低开口焦虑**（痛点①"没有真实对话场景、紧张说不出"）—— 目前用户卡壳时只能干等，没有任何引导。
2. **纠错讲清"为什么"**（痛点②"不知道自己错在哪"）—— 目前报告只列错误与改写，缺少口语化的原因解释；Speak 用户评价最高的恰恰是 "explains *why* it's awkward"。
3. **让进步看得见、可对比**（痛点③"看不到进步、缺乏动力"）—— 目前会话是内存态 `local-session`，练完即丢，无历史、无成长曲线（PRD US-05 AC5 的成长曲线尚未实现）。

本变更把这三件事正式形式化为规格并落地。

## What Changes

- 新增 **递台阶（Hint Engine）**：对话页检测到用户在语音/文字输入下长时间无输入（卡壳）时，AI 不打断对话，而是主动给出"开头词 / 2-3 个可点选的示例回答"，帮用户敢于开口。
- 新增 **隐性重述实时呈现（Implicit Recast）**：对话过程中 AI 自然重述用户的错误表达（不弹窗、不打断）；这些 recast 被结构化记录，并在报告里以 **"你说的" → "我帮你顺的"** 对照回放呈现。
- 新增 **"为什么"式纠错（Feedback Reasoning）**：报告中每条纠错与表达升级都附一句**口语化的原因解释**（`why` 字段），让用户理解而非死记。
- 新增 **成长档案与成长曲线（Growth Tracking）**：每次会话报告持久化到本地（IndexedDB/localStorage），首页与报告页可展示历史会话列表、5 维能力随时间的成长曲线，并给出近似 CEFR 等级估算。
- **Modified**：`Conversation.tsx` 接入卡壳检测与 hint 渲染、recast 提示的实时展示钩子；`report-generator.ts` 的 LLM prompt 与产出结构新增 `why` 与 `recasts` 字段；`Report.tsx` 增加 recast 回放区与成长曲线区；`ScenarioHub.tsx` 顶部状态栏接入真实的 streak/XP/历史数据。

## Capabilities

### New Capabilities

- `conversation-hint-engine`：定义"递台阶"能力。约束：卡壳检测 MUST 基于可配置静默阈值；hint MUST NOT 打断 AI 正在播放的语音；hint 内容由一次轻量 LLM 调用生成且失败时静默降级（不影响主对话）。
- `implicit-recast`：定义"隐性重述记录与回放"能力。约束：对话中 MUST NOT 弹窗打断；recast 记录 MUST 保留 `original` / `recast` / `turnId`；报告 MUST 以对照形式回放。
- `feedback-reasoning`：定义"为什么"式纠错能力。约束：报告中每条 correction 与 expression upgrade MUST 含非空 `why` 解释；解释 MUST 为口语化中文（面向中文学习者）。
- `growth-tracking`：定义会话持久化与成长曲线能力。约束：会话报告 MUST 持久化且可按时间检索；成长曲线 MUST 展示 5 维能力的历史趋势；无历史时 MUST 优雅空态而非报错。

### Modified Capabilities

（无 —— 上述行为此前未形式化为规格，本变更首次定义；对 `Conversation.tsx` / `Report.tsx` / `report-generator.ts` 的修改属实现层面，不改动已归档的 TTS 相关 capability 契约。）

## Impact

**契约**
- 修改：`shared/contracts.ts` —— `SessionReport` 新增 `recasts: Recast[]`；`Correction` / `ExpressionUpgrade` 新增 `why: string`；新增 `StoredSession`（持久化记录，含 timestamp、scenarioId、difficulty、radar）。

**前端**
- 修改：`web/src/pages/Conversation.tsx`（卡壳检测、hint 渲染、recast 实时提示）
- 修改：`web/src/pages/Report.tsx`（recast 回放区、成长曲线区、why 展示）
- 修改：`web/src/pages/ScenarioHub.tsx`（顶部状态栏接入真实 streak/XP/历史）
- 修改：`web/src/llm/report-generator.ts`（prompt 增补 why/recasts，产出结构扩展）
- 新增：`web/src/llm/hint-generator.ts`（卡壳时生成提示的轻量 LLM 调用）
- 新增：`web/src/store/history.ts`（会话历史持久层封装，IndexedDB/localStorage）
- 新增：`web/src/components/GrowthCurve.tsx`（成长曲线，懒加载 recharts）
- 新增：`web/src/hooks/useStallDetector.ts`（静默/卡壳检测 hook）

**后端**
- 无强制改动（hint 与 report 均可走现有前端 LLM 客户端）；若后续要把 recast 评测下沉到服务端再单列变更。

**配置 / 依赖**
- 不新增第三方依赖（复用 recharts、zustand、浏览器存储 API）。

**风险**
- 卡壳检测阈值过短会打扰用户、过长则无用 → 设默认 ~6s 且后续可在设置面板调；hint 失败必须静默降级。
- 成长曲线依赖持久化数据，首版从本地存储起步，避免引入后端存储的范围蔓延（遵循 PRD 范围边界：本期不做账号体系）。
- LLM 产出新增字段可能不稳定 → report-generator 需对缺失 `why`/`recasts` 做兜底默认值，保证不白屏。
