## Why

当前只有 3 个写死场景（面试/点餐/会议），覆盖面窄、易腻。竞品（Praktika 主打"任意话题自由聊"、ELSA 成体系角色场景）说明：**丰富场景 + 自由话题**是留存关键（PRD US-11）。

## What Changes

- 扩充 **场景库到 ≥ 9 个**，按分类组织（职场 / 生活 / 出行 / 社交 / 考试）+ 难度。
- 新增 **自由话题模式**：用户输入任意主题，即时生成一个对话场景开练。
- 新增 **随机场景**："给我来一个"随机挑场景 + 随机难度。
- **Modified**：首页按分类分组展示场景 + 自由话题入口 + 随机按钮；对话页支持自定义（自由话题）场景。

## Capabilities

### New Capabilities

- `scenario-library`：定义结构化、可分类、可扩展的场景库。约束：场景 MUST 带 `category` 与 `difficulty`；库 MUST ≥ 9 个且覆盖多个分类；新增场景不破坏既有 `Scenario` 契约。
- `free-topic`：定义自由话题能力。约束：用户输入任意主题 MUST 能生成可对话的场景（含 rolePrompt/goal）；自定义场景 MUST 能被对话页与报告页正确消费；输入为空时回退到通用闲聊。

### Modified Capabilities

（无破坏性改动；`Scenario` 仅新增可选 `category` 字段，向后兼容。）

## Impact

**契约**
- 修改：`shared/contracts.ts` —— `Scenario` 新增可选 `category`；`PRESET_SCENARIOS` 扩充到 ≥9；新增 `SCENARIO_CATEGORIES` 与 `buildFreeTopicScenario(topic, difficulty)`。

**前端**
- 新增：`web/src/lib/scenario.ts`（`getActiveScenario()` 解析预设/自定义）
- 修改：`ScenarioHub.tsx`（分类分组 + 自由话题输入 + 随机场景）、`Conversation.tsx`（用 `getActiveScenario()` 取代写死查找，支持自定义场景与开场白）

**风险**
- 场景多了首页变长 → 按分类折叠/分组、保持卡片一致风格。
- 自由话题 rolePrompt 需稳健（避免越界/跑题）→ 模板化约束语气与目标。
- 跨端（PWA/Capacitor）属 P3 的另一半，**不在本变更**，单独评估。
