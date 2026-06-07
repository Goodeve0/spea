## Context

**当前状态**

- 瓜友关系、贴纸、房间邀请的 **HTTP API 已完整**（`buddy.routes.ts` + `buddy.repo.ts`）。
- **发贴纸**：`POST /buddy/encouragements` 写入 `Encouragement` 表；`GET /buddy/encouragements` 返回列表并在读取时标记已读。前端 `sendSticker()` 仅 `loadBuddies()`，**无任何接收 UI**；`loadEncouragements()` 存在但未被任何页面调用。
- **约一把**：`Buddies.startRoom()` → `navigate('/room/new', { inviteUserId })` → `LiveRoom` 在 `room.created` 后 `POST /buddy/room-invite`。被邀请方仅在 `Buddies.tsx` 内 **5s 轮询** `GET /buddy/room-invite`；邀请存 **进程内存**（`room-invite.store.ts`），`takeRoomInvites` 取走即清。
- 沉浸式页面（`/conversation`、`/room/:id`）**无壳层**，当前无全局通知挂载点。

**约束**

- v1 **不引入 WebSocket 推送**，沿用 HTTP 轮询（与现有 room-invite 一致）。
- 不修改 Prisma schema；Buddy REST 路径与请求体保持不变（除非 room-invite 增加可选 query，向后兼容）。
- 单实例部署为默认；多实例 room-invite 内存不共享仍为已知限制。
- 种子瓜友（`isSeed`）不可登录，约一把保持 disabled；贴纸可发送（落库）但对方无真实客户端。

---

## Goals / Non-Goals

**Goals:**

1. 登录用户在任何页面（含沉浸式）能 **看到** 瓜友发来的贴纸通知，并感知发送成功/失败。
2. 登录用户在任何页面能 **看到** 双排房间邀请横幅，一键加入 `/room/:id`。
3. 邀请方「约一把」后进入等待房间，界面明确 **「已邀请 {name}，等待加入…」**；对方加入后自动开始（沿用现有 `room.ready`）。
4. 房间邀请在单实例下 **10 分钟 TTL** 内有效，过期自动丢弃；同 roomId 去重。
5. 复用现有 API；改动集中在 web 前端 + `room-invite.store` 小增强。

**Non-Goals:**

- WebSocket / SSE 实时推送。
- 贴纸持久「收件箱」页（v1 用 toast + 瓜友页摘要即可）。
- 约一把前完整场景选择器（v1 用最近练习场景或默认 `restaurant` + 后续 P1 弹窗）。
- 多实例 room-invite 一致性（Redis）。
- 修改瓜友匹配 / 加好友流程。

---

## Decisions

### 决策 1：全局通知 — `BuddyInboxPoller` 挂载在 `App.tsx`

**决策：** 新增 `web/src/components/BuddyInboxPoller.tsx`，在 `App.tsx` 的 `BrowserRouter` 内、与 `Routes` 同级渲染（不在 `AppShell` 内），当 `useAuthStore.user` 存在时启用。

**行为：**
- 每 **5s** 并行轮询：
  - `GET /buddy/encouragements` → 对响应中 `read === false` 的条目弹出 toast（见决策 2）。
  - `GET /buddy/room-invite` → 合并到 `buddyStore.pendingRoomInvites`（见决策 4）。
- 在 `/login` 或未登录时不挂载逻辑。

**理由：** 沉浸式页面（对话、直播间）不在 `AppShell` 下；只有 App 级挂载能覆盖全站。

**替代方案：**
- 仅 AppShell 内轮询 → 对话/报告页收不到 → 否决。
- WebSocket → 超 scope → 否决。

### 决策 2：贴纸通知 — Toast 栈 + 发送方即时反馈

**决策：**

| 角色 | UI |
|------|-----|
| **接收方** | 全局 toast：`{from.displayName} 给你发了「{sticker.label}」`，附贴纸 emoji/图标，3s 自动消失；可叠加最多 3 条 |
| **发送方** | `sendSticker` 成功后 toast「已发送给 {name}」；失败 toast「发送失败，请重试」 |

**去重：** `BuddyInboxPoller` 用 `shownEncouragementIdsRef`（Set）记录本会话已 toast 的 `id`，避免轮询重复弹出。页面刷新后允许再次展示未读（边界：GET 已标记 read 则不会重复）。

**瓜友卡片摘要（P1）：** `listBuddies` 加载后，在「我的瓜友」卡片上若该好友是最近贴纸发送方，显示小字「刚给你发了贴纸 ✨」（会话内 state，不持久）。

**理由：** `GET /buddy/encouragements` 读即标记已读，适合「通知型」而非「信箱型」；toast 实现成本低。

### 决策 3：约一把流程 — 场景选择轻量弹层 + 邀请方等待态

**决策：**

1. 点击「约一把」→ 打开 **轻量 Modal**（非新路由）：
   - 场景：默认 `localStorage.scenarioId` 或 `restaurant`；3 个快捷 chip（最近 / 餐厅 / 面试）+「使用当前默认」。
   - 难度：沿用 `localStorage.difficulty` 或 `beginner`。
   - 确认 → `navigate('/room/new', { state: { scenarioId, difficulty, inviteUserId } })`（与现逻辑一致）。

2. **LiveRoom 等待态**（`status === 'waiting'`）文案：
   - 有 `inviteUserId`：`已邀请 {buddyName}，等待 TA 加入…`（buddyName 从 navigation state 传入）。
   - 无邀请：保持现有「等待队友…」。

3. 对方在全局横幅点「加入」→ `navigate(/room/${roomId})` → 现有 `joinRoom` WS 流程。

**理由：** 固定 `restaurant/beginner` 体验差；Modal 不增加路由复杂度。

### 决策 4：房间邀请存储 — TTL + 去重 + 取走语义不变

**决策：** 增强 `server/src/http/room-invite.store.ts`：

```typescript
const INVITE_TTL_MS = 10 * 60 * 1000; // 10 分钟

addRoomInvite(toUserId, fromUserId, roomId):
  - 过滤 expired
  - 同 toUserId + roomId 去重（保留最新 createdAt）
  - push 新邀请

takeRoomInvites(toUserId):
  - 返回未过期列表并 delete key（与现语义一致）
```

不在 v1 改为 peek/ack（避免 API 变更）；横幅展示期间若用户 5s 内未操作且下次 poll 已 take，可能丢失——通过 **Poller 收到后立即写入 zustand**，横幅由 store 驱动，不依赖下次 poll。

**前端 store：**

```typescript
pendingRoomInvites: RoomInviteDTO[]
addRoomInvites(invites)  // merge by roomId
dismissRoomInvite(roomId)
```

`BuddyInboxPoller` 收到新 invite 合并进 store；`Buddies.tsx` 与全局 **共用** `BuddyInviteBanner` 组件渲染 store 数据（移除 Buddies 页内本地 `roomInvites` state）。

**理由：** 最小后端改动；store 层解决 take 即清导致的 UI 丢失。

### 决策 5：轮询与性能

**决策：** 5s 间隔；页面 `document.hidden` 时降频到 15s（Page Visibility API）。登录后立即 poll 一次。

**理由：** 与现 Buddies 一致；后台 tab 省流量。

### 决策 6：测试策略

| 层 | 覆盖 |
|----|------|
| `room-invite.store` | TTL 过期、roomId 去重单元测 |
| `buddy.routes.test.ts` | 回归 room-invite + encouragements |
| `web/src/store/buddy.test.ts` | merge invites、sendSticker toast 回调 mock |
| 可选 | Poller 集成：mock api，断言新 encouragement 触发 toast |

---

## Risks / Trade-offs

- **[Risk] 内存 room-invite 服务重启丢失** → 文档注明；v1 可接受；后续可落库。
- **[Risk] 多 Tab 同时 poll，take 竞争** → 单用户多端较少；横幅在 store，先展示者优先。
- **[Risk] GET encouragements 读即已读，用户未看到 toast 就刷新** → 贴纸仍可在瓜友页「最近互动」摘要看到（P1）；核心路径 toast 3s + 明显样式。
- **[Risk] 种子瓜友收不到贴纸** → 发送方仍显示成功（已落库）；产品说明示例账号无真实客户端。
- **[Risk] 对话页轮询 + 语音可能略增后台请求** → hidden 降频 15s。

---

## Migration Plan

1. 后端：`room-invite.store.ts` TTL/去重 + 单测。
2. 前端：`buddy.ts` store 扩展 + `BuddyInboxPoller` + `BuddyInviteBanner` + `BuddyToast`。
3. 改 `Buddies.tsx`：Modal 约一把、移除本地 invite state、发送贴纸反馈。
4. 改 `LiveRoom.tsx`：等待态文案、`inviteBuddyName` state。
5. `App.tsx` 挂载 Poller。
6. 手动双账号验证：A 发贴纸 → B 任意页 toast；A 约一把 → B 横幅加入 → 双人 room.active。

**回滚：** 移除 Poller 与 store 字段，恢复 Buddies 本地轮询即可；后端 TTL 为 additive。

---

## Open Questions

1. **约一把场景 Modal** 是否在 v1 必做，还是继续默认 restaurant？—— 建议 v1 做 3-chip 轻量选择。
2. **贴纸 toast** 是否在 `/room/:id` 练习中显示？—— 建议显示（不阻塞练习），可点 × 关闭。
3. **未读贴纸持久列表** 是否后续单独开 change？—— v1 不做。
