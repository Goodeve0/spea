## Context

线上"约一把"邀请送达链路已断：发起方点击「开始邀请」→ 创建房间 → 发送邀请，对方在任意页面均收不到横幅。代码侧已定位 4 处可疑点（详见 proposal）：

1. `web/src/pages/LiveRoom.tsx:108-113` `api.buddy.sendRoomInvite` 是 fire-and-forget 的 `.then()`，无 await、无 catch、无日志；任何 4xx/5xx/网络错都被静默丢失。
2. `web/src/components/BuddyInboxPoller.tsx:50-52` `catch { /* 轮询失败静默 */ }` 完全吞所有异常（含 401）。
3. `server/src/http/room-invite.store.ts:31` `takeRoomInvites` 取走即 `delete`：`BuddyInboxPoller` 每 5s 拉一次，B 用户多 Tab 并发时第一个拉到的 Tab 取走、其它 Tab 看不到；同一用户跨设备同样。
4. 服务端 POST/GET `/buddy/room-invite` 完全无访问日志，生产无法在不进容器的情况下确认是否真正写入或回收。

存储：进程内 `Map<toUserId, RoomInvite[]>`，TTL 10 分钟，docker `compose up -d` 重启即丢。生产是单容器单进程（`spea-server-1`），不存在多副本的并发副作用，但意味着重启后所有挂起邀请丢失。

约束：
- 必须保留向后兼容，前端 `RoomInviteDTO` 与 `Api.RoomInviteResp` 契约不变；
- 不引入持久化（DB）或外部依赖（Redis）；
- 修复必须可在不停容器的情况下通过更新 web/dist + 单容器重启完成。

## Goals / Non-Goals

**Goals:**
- 端到端送达可观测——发起方有成功/失败 UI 反馈，服务端有结构化访问日志，便于线上无侵入排查。
- 多 Tab/多设备同一用户均能稳定收到同一邀请，直至用户接受或 TTL 过期。
- 邀请方失败不再静默：`POST /buddy/room-invite` 任一非 2xx 都 toast 提示并 `console.error`。
- 修复后保留单元 + 集成回归覆盖核心路径。

**Non-Goals:**
- 不做持久化落库（SQLite/Prisma 模型新增），保留下次变更评估。
- 不做多副本部署兼容（Redis pub/sub、分布式锁）。
- 不做邀请历史/撤回/接受拒绝回执——`buddy-interaction` 现状仅一次性送达，本次保持。
- 不修改 `RoomInviteDTO` / API 响应结构。
- 不重写 WebSocket 通道做主动推送（现状靠 5s 轮询，已能在用户感知阈内送达）。

## Decisions

### D1：`takeRoomInvites` 改为「读后标记 delivered」而非删除

**选项**：
- A. 保留现状（`delete` 整列）。
- B. 在 `RoomInvite` 上加 `delivered: boolean`，`takeRoomInvites` 过滤未 delivered，调用方一旦响应成功（`res.json()` 返回前）由 store 内部标记 delivered。
- C. 把"是否已送达"挪到客户端去重（前端 store 维护已读 set），服务端仍 delete。

**选 B**：
- 与 spec「TTL 内同接收方多次读取均可见」一致；
- 改动最小，仅 `room-invite.store.ts` 改 `delete` → 标记，`addRoomInvite` 重新出现同 `roomId` 时把 `delivered` 重置为 false（与现有"按 roomId 去重，保留最新 createdAt"语义统一）；
- C 方案要求所有客户端串通去重，浏览器隐身/不同设备协调成本高，且无法解决"发起方刚发送、接收方刷新即丢"的窗口问题。

**实现细节**：
```ts
interface RoomInvite { roomId; fromUserId; createdAt; delivered: boolean; }

// add：去重时新覆盖旧，delivered = false
// take：返回未 delivered 且未过期；标记 delivered = true，但条目保留至 TTL 自然过期由 prune 移除
// 不再 invites.delete(toUserId)
```

TTL 过期的 prune 由 `pruneExpired` 在每次 add/take 时执行，不需要后台定时器。`clearRoomInvites()` 测试钩子语义不变（清空 Map）。

### D2：`POST /buddy/room-invite` 改为前端 await + UI 反馈

**选项**：
- A. 在 `LiveRoom.tsx:108-113` 内联 try/catch + 弹 toast。
- B. 把 `sendRoomInvite` 调用挪到 `useBuddyStore.sendRoomInvite()`，统一错误处理与 toast。
- C. 走 zustand store 但失败回滚等待态。

**选 B**：
- store 已有 `showToast`/`sendRoomInvite`（line 53），但当前没有任何调用方；本变更把 LiveRoom 的内联调用切到 store action，保持错误处理统一。
- 调用方式：
  ```ts
  case 'room.created': {
    setRoomId(p.roomId);
    if (inviteUserIdFromState) {
      void useBuddyStore.getState().sendRoomInvite(inviteUserIdFromState, p.roomId);
    }
    setStatus('waiting');
    break;
  }
  ```
- store 内部：try `api.buddy.sendRoomInvite` → 失败 toast「邀请发送失败：{message}」+ `console.error('[buddy.sendRoomInvite] failed:', { roomId, toUserId }, error)`；成功不 toast（避免与等待态文案重叠，等待态本身就是成功反馈）。
- 不回滚等待态：房间创建是 WS 流，邀请失败时 LiveRoom 仍是合法的等待房间，用户可手动离开或邀请其他瓜友的链路在下次变更评估。

### D3：`BuddyInboxPoller` 错误分类

**映射规则**：
| 错误 | 动作 |
|---|---|
| `ApiError.status === 401` | `useAuthStore.getState().logout()` + `navigate('/login')` 等价（实际通过 `window.location.assign('/login')` 或 store action）；本次会话内同一 user 仅触发一次 |
| 其它 `ApiError` / fetch reject | `console.warn('[BuddyInboxPoller.poll] failed:', error)`；不弹 toast；下一周期重试 |

**为何不弹 toast**：5s 轮询窗口下网络抖一下都可能错，弹 toast 会让用户每分钟看 12 个错误提示；`console.warn` 满足 ai-code-rules 第 15 条对 catch 块加日志的要求，不打扰用户。

**避免登出循环**：用 module-scoped `let didLogout401 = false`（在 effect 外）防止 401 后未及时 unmount 又触发第二次 logout。

### D4：服务端 `/buddy/room-invite` 结构化访问日志

POST：
```
[buddy.room-invite POST] from=<fromUserId> to=<toUserId> room=<roomId> queueSize=<after>
```
GET：
```
[buddy.room-invite GET] user=<toUserId> returned=<n> remaining=<m>
```
- `console.log` 写 stdout 即可，docker compose logs 直接可见；不引入 pino/winston。
- 字段足够生产排查"我发了对方为啥没收到"——任何一行缺失即定位到具体环节。
- ai-code-rules 第 15 条要求 catch / 业务校验失败 / 异常状态变化记日志；这里 POST/GET 都是关键状态变化，写 `console.log` 而非 `console.error`（非异常）。

### D5：前端 store 增加「已 dismiss 黑名单」防止横幅重弹

服务端改 D1 后，第一次 GET 返回邀请、用户关闭横幅、第二次 GET 在 markDelivered 落地前已发出 → 仍可能让横幅重弹。需在前端 store 加：

```ts
dismissedRoomIds: Set<string>      // 当前会话内已被 dismiss 的 roomId
mergeRoomInvites(incoming): 跳过 dismissedRoomIds 命中项
dismissRoomInvite(roomId): 同时加入 dismissedRoomIds
resetInbox(): 清空 dismissedRoomIds
```

`dismissedRoomIds` 仅活在内存，刷新页面即清——这是有意为之：刷新意味着用户主动重新评估当前可加入房间的状态，重新展示也是合理 UX。10 分钟 TTL 由服务端兜底。

### D6：测试策略

- **单元测试**：
  - `room-invite.store.test.ts` 补 3 条用例：(a) 同 toUser 第二次 take 仍可读，直至接收完成；(b) 接收完成后再 take 返回空；(c) TTL 过期后无论 delivered 与否均不再返回。
  - 新增 `web/src/store/buddy.test.ts` 覆盖 `sendRoomInvite` 失败 toast、`mergeRoomInvites` 跳过 dismissed。
- **集成 e2e**：本仓库无 Playwright，跳过端到端浏览器测试；改为 `BuddyInboxPoller` 单测（mock api，注入 401 / 网络错 / 正常三种 case）。

## Risks / Trade-offs

- **进程重启丢邀请** → 单容器单实例假设下风险小（容器重启 ~10s，TTL 10min 内重启用户重新点「约一把」即可）；mitigations：在 D4 日志里写明 `restart cleared invites`（启动时打印一行）。
- **多副本部署破坏 D1** → 当前生产单容器，不实际触发；如未来多副本，需替换为 Redis 或 DB；本变更在 README/DEPLOY 不显式提，避免误导读者以为需要分布式存储。
- **D5 dismissedRoomIds 内存增长** → 仅当前会话，单用户单 Tab 上限即 invitee 收到的邀请数（按经验最多几十条）；可不主动清理。
- **D2 不回滚等待态** → 邀请发送失败后房间仍处 `waiting`，UX 上略显割裂；mitigations：toast 文案显式提示用户可重试或返回 `/buddies`，下个变更可补「房间侧 retry 邀请」按钮。

## Migration Plan

1. **变更前**：拉 PR；CI 跑通 server vitest + web vitest。
2. **部署顺序**：
   - 先 build web → scp dist → atomic swap（前端兼容旧后端：`takeRoomInvites` 行为差只是"多读到一次邀请"，前端 D5 黑名单已能去重，安全）。
   - 后部署 server：`docker compose up -d server`，约 10s 停机；停机期间所有挂起邀请丢失（与现状一致）。
3. **回滚**：
   - 前端：`mv dist-bak-<timestamp> dist`。
   - 后端：`docker compose pull --quiet` + 上一个镜像 tag（或 `git checkout` 上一个 commit 重 build）。
4. **验证清单**：
   - `curl https://spea.xiaoyangxiaozhang.xyz/api/health` = 200。
   - 双账号实测：A 约 B → B 在 5s 内看到横幅 → 关闭 → 不重弹 → 10 分钟内重新登录 B 仍能在第一次 poll 看到。
   - `docker compose logs --tail=50 server | grep buddy.room-invite` 见到 POST/GET 两类日志。

## Open Questions

- 邀请超时（10 分钟）后是否要给发起方一个"对方未响应"的提示？本变更范围外，列入下一个 buddy-interaction 变更。
- WS 直推替代 5s 轮询的代价/收益评估？同样下一个变更评估，本次保持轮询。
