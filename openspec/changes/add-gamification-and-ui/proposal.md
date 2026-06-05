## Why

P2 目标是"留存与复盘"。当前两个体验短板（用户明确反馈）：

1. **奖励看不见**：练完没有即时正反馈，首页只有孤零零的 streak/XP 数字，缺乏等级、成就、目标等长期激励（PRD US-10）。
2. **报告页/顶栏不够好看**：缺少成就感设计与庆祝时刻。

本变更补齐 **游戏化激励系统** 与 **报告页/顶栏 UI 重做**。

> **音频回放（US-09-AC2）不在本变更范围**：它强依赖对象存储（录制双向音频→上传→存储→回放），需先建设存储基础设施，单独立项评估。本期文本回放（对话回顾）已具备。

## What Changes

- 新增 **游戏化逻辑层**：基于已有成长数据（XP/streak/会话）纯前端计算等级、等级进度、连击里程碑、成就解锁、每日目标状态。
- 新增 **即时奖励反馈**：报告页展示"本次 +XP、连击 +1"，达成升级/里程碑时播放庆祝动画。
- 新增 **成就系统**：首页展示成就徽章墙（已解锁/未解锁）。
- **Modified**：首页顶栏重做为"等级 + 进度条 + 连击 + 头像"；报告页 UI 进一步打磨。

## Capabilities

### New Capabilities

- `gamification`：定义等级/XP/连击/成就/每日目标的计算与展示规则。约束：等级与成就 MUST 基于真实成长数据计算（不得写死）；即时奖励 MUST 在每次有效练习后出现；升级/里程碑 MUST 有庆祝反馈。

### Modified Capabilities

- `growth-tracking`：在成长数据之上叠加等级/成就的派生展示（不改变底层数据来源）。

## Impact

**前端**
- 新增：`web/src/lib/gamification.ts`（等级/成就纯逻辑）、`web/src/components/ui/LevelBar.tsx`、`web/src/components/AchievementWall.tsx`、`web/src/components/RewardBanner.tsx`
- 修改：`ScenarioHub.tsx`（顶栏等级进度 + 成就墙）、`Report.tsx`（即时奖励 + 庆祝 + UI 打磨）、`tailwind.config.js`（庆祝动画 keyframes）

**契约 / 后端**
- 无改动（完全基于 P1 已有的成长数据派生）。

**风险**
- 等级/成就规则需手感平衡（阈值过高无成就感、过低无挑战）→ 阈值集中常量、可调。
- 庆祝动画避免打扰 → 轻量、可跳过、仅在达成时触发。
