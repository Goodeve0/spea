## 1. 服务端：room-invite.store 改读后标记 delivered（D1）

- [ ] 1.1 修改 `server/src/http/room-invite.store.ts`：在 `RoomInvite` 接口加 `delivered: boolean`；`addRoomInvite` 在去重覆盖与新增时均把 `delivered` 设为 `false`；`takeRoomInvites` 改为返回未过期且 `delivered === false` 的快照，并把命中条目就地标记 `delivered = true`（保留在 Map 中，不再 `invites.delete`）。
- [ ] 1.2 同文件保持 `pruneExpired` 在 add 时清理过期项不变；新增导出 `markAllDelivered(toUserId: string): void`（仅测试用，可选）以便单元测试验证状态。
- [ ] 1.3 更新 `server/src/http/room-invite.store.test.ts`：
  - [ ] 1.3.1 调整既有 `takeRoomInvites returns and clears pending invites` 用例语义：第二次 take 返回 `[]`（因首次 take 已 markDelivered，而非删除）。
  - [ ] 1.3.2 新增「同 toUserId 第二次 take 在首次 take 之前仍可见」用例（模拟多 Tab 并发：两次连续 takeRoomInvites 都至少看到 1 条；在两次之间不应丢失）——具体写法：第一次 take 后**手动验证内部状态**或第一次 take 仍在 await 时第二次 take。这里采用简化方案：分两次 add 同 roomId 验证 dedup 行为不受 delivered 影响（add 时 delivered 重置）。
  - [ ] 1.3.3 新增「addRoomInvite 同 roomId 重复发送会重置 delivered」用例：先 add → take（delivered=true）→ 再 add 同 roomId → take 仍能取到。
  - [ ] 1.3.4 新增「TTL 过期后即便未 delivered 也不返回」用例。

## 2. 服务端：/buddy/room-invite 加结构化访问日志（D4）

- [ ] 2.1 修改 `server/src/http/buddy.routes.ts` POST `/buddy/room-invite`：在 `addRoomInvite` 后输出 `console.log('[buddy.room-invite POST] from=%s to=%s room=%s queueSize=%d', fromUserId, toUserId, roomId, queueSize)`；queueSize 通过新导出的 `peekQueueSize(toUserId)` 读取。
- [ ] 2.2 同文件 GET `/buddy/room-invite`：在响应前输出 `console.log('[buddy.room-invite GET] user=%s returned=%d remaining=%d', toUserId, returnedCount, remainingUndelivered)`。
- [ ] 2.3 在 `server/src/http/room-invite.store.ts` 导出 `peekQueueSize(toUserId: string): number`：返回未过期且未 delivered 的条目数（不修改状态）。
- [ ] 2.4 `room-invite.store.test.ts` 补 `peekQueueSize` 用例（add 后 +1；take 后 0；TTL 过期后 0）。

## 3. 前端：LiveRoom 邀请改 await + 错误反馈（D2）

- [ ] 3.1 修改 `web/src/store/buddy.ts` 中 `sendRoomInvite` action：try `api.buddy.sendRoomInvite(token, toUserId, roomId)`；catch 块 `console.error('[buddy.sendRoomInvite] failed:', { roomId, toUserId }, error)` 并 `get().showToast('邀请发送失败：' + (error instanceof ApiError ? error.message : '请重试'))`。成功不弹 toast。
- [ ] 3.2 修改 `web/src/pages/LiveRoom.tsx:108-113`：把内联动态 import + fire-and-forget 替换为 `void useBuddyStore.getState().sendRoomInvite(inviteUserIdFromState, p.roomId)`，移除局部 `import('../api/client')`。
- [ ] 3.3 同文件文件顶部新增 `import { useBuddyStore } from '../store/buddy'`，import 排序遵循 `.claude/rules/ai-code-rules.md` §11（5 组分隔，组内字母序）。
- [ ] 3.4 在 `web/src/store/buddy.test.ts` 新增 2 个用例：(a) `sendRoomInvite` 成功不调 showToast；(b) 失败时调用 showToast 且 console.error 被触发（可用 `vi.spyOn(console, 'error')`）。

## 4. 前端：BuddyInboxPoller 错误分类（D3）

- [ ] 4.1 修改 `web/src/components/BuddyInboxPoller.tsx`：从 `../api/client` 引入 `ApiError`；从 `../store/auth` 引入 `useAuthStore`（已引）+ `logout` action（若不存在则调用 `useAuthStore.getState().clearToken()` 等价方法，先读 `web/src/store/auth.ts` 确认）。
- [ ] 4.2 在文件顶层（模块作用域）新增 `let didLogout401 = false` 防止重复登出；catch 块改为：
  - 若 `error instanceof ApiError && error.status === 401` 且 `!didLogout401` → `didLogout401 = true`；调用 logout/清 token；通过 `window.location.assign('/login')` 跳转（组件无 navigate hook）。
  - 其它分支 → `console.warn('[BuddyInboxPoller.poll] failed:', error)`，不弹 toast。
- [ ] 4.3 user 切换或登出时（已存在的 `if (!user)` 分支）重置 `didLogout401 = false` 以便下次登录后能再次触发。
- [ ] 4.4 新增 `web/src/components/BuddyInboxPoller.test.ts`（同目录现有无测试 → 新建一个；先读同目录其它组件测试或 `web/src/store/buddy.test.ts` 对齐风格）：
  - [ ] 4.4.1 mock `api.buddy.encouragements` reject `new ApiError(401, 'UNAUTHORIZED', 'unauthorized')` → 期望 `window.location.assign` 被调一次且仅一次。
  - [ ] 4.4.2 mock reject 普通 Error → 期望 `console.warn` 被调用且 `window.location.assign` 不被调。
  - [ ] 4.4.3 mock 正常返回 → 期望 `mergeRoomInvites` 被调（已有路径）。

## 5. 前端：buddy store dismissedRoomIds 黑名单（D5）

- [ ] 5.1 修改 `web/src/store/buddy.ts`：`BuddyState` 新增 `dismissedRoomIds: Set<string>`（init 为新 Set）。
- [ ] 5.2 改 `mergeRoomInvites(incoming)`：先 `incoming.filter((i) => !s.dismissedRoomIds.has(i.roomId))` 再走原 `mergeRoomInviteList`。
- [ ] 5.3 改 `dismissRoomInvite(roomId)`：在 filter 移除 pending 之外，把 roomId 加入 `dismissedRoomIds`（用 `new Set([...s.dismissedRoomIds, roomId])` 保持不可变更新）。
- [ ] 5.4 改 `resetInbox()`：把 `dismissedRoomIds` 重置为空 Set。
- [ ] 5.5 `web/src/store/buddy.test.ts` 补 1 用例：dismiss 一条 → 再次 mergeRoomInvites 含同 roomId → pendingRoomInvites 中不再出现。

## 6. 规格回填与文档同步

- [ ] 6.1 在 `proposal.md` 与 `design.md` 之间无矛盾后，运行 `openspec validate fix-buddy-invite-not-received` 通过。
- [ ] 6.2 `openspec/changes/fix-buddy-invite-not-received/specs/buddy-interaction/spec.md` 已落到位（先前任务），仅在实现完毕后由归档阶段同步主 spec（不在本变更内做）。

## 7. 本地与生产验证（Migration）

- [ ] 7.1 在仓库根目录运行 `npm run build -w server` + `npm run test -w server` 通过。
- [ ] 7.2 在仓库根目录运行 `npm run build -w web` + `npm run test -w web` 通过；扫描 `web/dist/assets/index-*.js` 确认无 `localhost:3002` / `ada-cli-golang` 泄漏。
- [ ] 7.3 本地 docker compose（或开发模式）双账号实测：A 在 `/buddies` 约 B → B 5 秒内任意页面看到横幅 → B 关闭 → 后续两次轮询不重弹 → B 重新点开 `/room/{roomId}` 能进入。
- [ ] 7.4 部署到生产：
  - [ ] 7.4.1 scp `web/dist` → 服务器 `/tmp/spea-dist-new` → 原子 `mv` 到 `/www/wwwroot/spea/web/dist`，旧版本备份为 `dist-bak-<timestamp>`。
  - [ ] 7.4.2 服务器 `cd /www/wwwroot/spea && git pull origin main`（或 bundle 中转）+ `docker compose up -d server`。
  - [ ] 7.4.3 `curl -fsS https://spea.xiaoyangxiaozhang.xyz/api/health` 与 `/llm/api/health` 均 200。
  - [ ] 7.4.4 双账号生产实测同 7.3 步骤。
  - [ ] 7.4.5 `docker compose logs --tail=200 server | grep buddy.room-invite` 见到 POST/GET 两类日志各至少一条，且字段完整。
- [ ] 7.5 回滚预案验证（不实操，仅文档化在 PR description）：`mv /www/wwwroot/spea/web/dist-bak-<timestamp> dist` + `git checkout <prev-sha> && docker compose up -d server`。
