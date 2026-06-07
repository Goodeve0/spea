## Why

线上 `/buddies` 页"约一把"流程出现核心断链：邀请方完成"选场景/难度 → 开始邀请"后，被邀请方在任意页面均**收不到**横幅提示，瓜友双排功能事实失效。该链路是 `buddy-interaction` 规格的关键路径，目前发起方与接收方两端都缺少可观测信号，无法在不进容器的情况下定位首个断点。需先补好可观测性、再消除最可能的几处静默失败点，让送达可验证、可恢复。

## What Changes

- **发起方可观测**：`LiveRoom` 在 `room.created` 之后调 `api.buddy.sendRoomInvite` 由 fire-and-forget 改为带成功/失败反馈：成功时设置「已邀请 {buddyName}，等待 TA 加入…」等待态、失败时 toast「邀请发送失败，请重试」并记 `console.error`。
- **接收方可观测**：`BuddyInboxPoller` 的 `catch` 不再完全吃异常——401 触发登出引导、连续 N 次网络错记录最后一次错误（不弹 toast 以免打扰）。
- **服务端可观测**：`POST /buddy/room-invite` 与 `GET /buddy/room-invite` 加结构化访问日志（fromUserId / toUserId / roomId / 队列大小），便于在生产即时核查是否真正写入与回收。
- **取走即清语义修正**：`takeRoomInvites` 当前一次轮询取走即清，导致多 Tab/多设备并发轮询时第二个调用方丢失邀请；改为按 `roomId` 标记 `delivered` 而非整列 `delete`，仍保留 10 分钟 TTL。
- **跨重启耐久化评估**：进程内 `Map` 在容器重启时清空、且与生产单容器假设强耦合。本次仅补 design.md 决策（保留内存 vs 落表），实现仍维持内存方案，以最小改动恢复功能；必要时下一变更落库。
- **回归用例**：补一条 e2e/集成回归覆盖"A 发邀请→B 5s 内拿到→点加入进入房间"端到端，避免本类回归再次悄悄破坏主路径。

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `buddy-interaction`：在「全局展示双排房间邀请横幅」与「房间邀请服务端 TTL 与去重」两个 Requirement 上补充
  - 发起方 `sendRoomInvite` 调用结果 MUST 反馈到 UI，不得静默失败
  - 接收方轮询失败 MUST 区分鉴权失败与瞬时网络错，不得 100% 静默
  - 同一邀请 MAY 被同一用户多次轮询读取，直到 `delivered` 标记或 TTL 过期

## Impact

- **代码**：
  - `web/src/pages/LiveRoom.tsx`（`room.created` 分支调用 `sendRoomInvite` 改为可观测）
  - `web/src/components/BuddyInboxPoller.tsx`（拆分错误类型）
  - `server/src/http/buddy.routes.ts`（POST/GET `/buddy/room-invite` 加日志）
  - `server/src/http/room-invite.store.ts`（`takeRoomInvites` 改为标记 `delivered` 而非 `delete`）
- **规格**：`openspec/specs/buddy-interaction/spec.md`（增量更新两个 Requirement 的 Scenario）
- **测试**：
  - `server/src/http/room-invite.store.test.ts` 补多次 take 不丢失用例
  - 新增 `web/src/components/BuddyInviteBanner` 端到端回归（轻量级，至少一条 happy path）
- **API/契约**：响应结构不变；`/buddy/room-invite` 行为语义微调（可重复读到同条邀请，直至 `delivered`/TTL）→ 前端已按"按 roomId 去重"实现，无破坏。
- **依赖与系统**：无新增外部依赖；后端依旧单进程内存存储，多副本部署需在 design.md 标注限制。
