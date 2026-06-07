## 1. 后端：房间邀请 TTL 与去重

- [x] 1.1 增强 `server/src/http/room-invite.store.ts`：`INVITE_TTL_MS = 10min`；`addRoomInvite` 过滤过期、同 `toUserId+roomId` 去重；`takeRoomInvites` 仅返回未过期列表
- [x] 1.2 新增 `server/src/http/room-invite.store.test.ts`：覆盖 TTL 过期、roomId 去重、take 清空
- [x] 1.3 运行 `npm test -w server -- room-invite` 与 `buddy.routes` 回归全绿

## 2. 前端 Store 与 Toast 基础设施

- [x] 2.1 扩展 `web/src/store/buddy.ts`：新增 `pendingRoomInvites`、`toastMessage`（或独立 toast store）；实现 `mergeRoomInvites`、`dismissRoomInvite`、`showToast`、`clearToast`
- [x] 2.2 更新 `sendSticker`：成功/失败调用 `showToast`；保留 `loadBuddies`
- [x] 2.3 新增 `web/src/components/BuddyToast.tsx`：全局 toast 栈（最多 3 条、3s 自动消失、可手动关闭），消费 store 或 props
- [x] 2.4 新增 `web/src/store/buddy.test.ts`：`mergeRoomInvites` 按 roomId 去重、`dismissRoomInvite` 移除

## 3. 全局轮询与邀请横幅

- [x] 3.1 新增 `web/src/components/BuddyInboxPoller.tsx`：登录时 5s 轮询（hidden 15s）；并行 `encouragements` + `room-invite`；未读贴纸 toast（`shownEncouragementIdsRef` 去重）；invite 合并进 store
- [x] 3.2 新增 `web/src/components/BuddyInviteBanner.tsx`：渲染 `pendingRoomInvites`；「加入」→ `navigate(/room/:id)`；「×」→ `dismissRoomInvite`
- [x] 3.3 在 `web/src/App.tsx` 挂载 `BuddyInboxPoller` + `BuddyInviteBanner` + `BuddyToast`（与 `Routes` 同级，覆盖沉浸式页面）

## 4. 瓜友页：贴纸反馈与约一把 Modal

- [x] 4.1 重构 `web/src/pages/Buddies.tsx`：移除本地 `roomInvites` state 与轮询逻辑（改由全局 Poller + store）
- [x] 4.2 新增约一把轻量 Modal：场景 chip（最近/餐厅/面试）+ 难度；确认后 `navigate('/room/new', { scenarioId, difficulty, inviteUserId, buddyName })`
- [x] 4.3 发贴纸 UI：发送成功后关闭贴纸 grid；失败显示 store toast

## 5. 直播间：邀请方等待态

- [x] 5.1 更新 `web/src/pages/LiveRoom.tsx`：从 `location.state` 读取 `buddyName`；`status === 'waiting'` 且有 invitee 时显示「已邀请 {buddyName}，等待 TA 加入…」
- [x] 5.2 确认 `room.created` 后 `sendRoomInvite` 仍正常触发（与 Modal 传入的 `inviteUserId` 一致）

## 6. 验证

- [x] 6.1 `npm test -w web -- buddy` 与 `npm run lint -w web` 通过
- [ ] 6.2 双账号手工验证：A 发贴纸 → B 在 `/practice` 或 `/conversation` 见 toast；A 约一把 → B 见横幅 → 加入后双人 room.active；邀请方见等待文案
