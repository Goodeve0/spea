## Why

瓜友「我的瓜友」页已提供「发贴纸」与「约一把」入口，但玩家点击后几乎感受不到与对方的真实互动：贴纸写入后端却无接收 UI，约一把依赖仅在瓜友页轮询的内存邀请，导致社交功能形同虚设。需要在不推翻现有 Buddy HTTP API 的前提下，补齐双向可见的交互闭环，让两名真实用户能互相收到贴纸、接受双排邀请并进入练习房间。

## What Changes

- **贴纸接收与反馈**
  - 登录用户 SHALL 能在应用内看到瓜友发来的贴纸（收件箱/横幅/toast，具体 UI 见 design）。
  - 发送贴纸后 SHALL 有明确成功反馈（如「已发送给 cc」），失败时提示重试。
  - 进入瓜友页或全局轮询时拉取未读贴纸；展示后标记已读（沿用现有 `GET /buddy/encouragements` 读即标记逻辑）。

- **约一把（双排邀请）可感知、可加入**
  - 被邀请方 SHALL 在**任意页面**（不仅 `/buddies`）收到房间邀请通知，并可一键「加入」跳转 `/room/:id`。
  - 邀请方点击「约一把」后 SHALL 进入创建/等待房间流程，并成功向瓜友投递邀请；邀请方看到「已邀请，等待对方加入」状态。
  - 改善房间邀请送达可靠性：至少保证单实例部署下邀请在合理 TTL 内可被取走；发送方离开瓜友页仍能收到对方加入反馈（design 阶段定细节）。

- **交互约束（保持现有边界）**
  - 仍仅瓜友之间可发贴纸、可约一把（沿用 `areBuddies` 校验）。
  - 种子瓜友（`isSeed`）仍不可被约一把；贴纸行为 design 阶段确认是否允许。
  - 不新增用户搜索/加好友 ID；发现流仍走现有匹配 + 邀请成为瓜友。

- **可选增强（P1，design 取舍）**
  - 贴纸在瓜友卡片上显示「最近收到」摘要。
  - 房间邀请过期自动清理（如 10 分钟未加入）。

## Capabilities

### New Capabilities

- `buddy-interaction`: 瓜友贴纸与双排邀请的双向 UI 交互——发送反馈、接收展示、全局通知、加入房间、轮询/状态管理。

### Modified Capabilities

（无 — 不修改 TTS、报告导出、发音评测等已有规格；Buddy REST 契约保持不变，仅前端消费方式与可选的通知层增强）

## Impact

- **前端 UI**
  - `web/src/pages/Buddies.tsx` — 发送反馈、贴纸展示、约一把流程优化
  - 新增全局组件（如 `BuddyNotificationPoller` / 布局层挂载）— 跨页贴纸与房间邀请
  - `web/src/store/buddy.ts` — 加载/展示 encouragements、room invite 状态
  - `web/src/pages/LiveRoom.tsx` — 与「约一把」创建房间、邀请投递衔接

- **后端（最小改动）**
  - `server/src/http/buddy.routes.ts` — 可能微调 room-invite 轮询（如未读计数、TTL）；贴纸 API 已满足，优先复用
  - `server/src/http/room-invite.store.ts` — 可选 TTL / 去重；多实例部署仍非本期目标

- **共享类型**
  - `shared/contracts.ts` — 仅在有新字段需求时扩展（如邀请过期时间）；默认不 breaking

- **测试**
  - `buddy.routes.test.ts` 回归
  - 前端 buddy store / 通知组件单测或集成测

- **不涉及**
  - WebSocket 实时推送（v1 仍 HTTP 轮询，design 可预留）
  - 瓜友匹配算法、Prisma schema 大改
