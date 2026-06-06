## 1. 共享契约（shared/contracts.ts）

- [x] 1.1 新增瓜友 DTO：`BuddyCard`、`BuddyRelation`（含 cooling 状态、连胜天数）、`BuddyRequestDTO`、`EncouragementDTO`、`RankingEntry`、`PublicProfileUpdate`
- [x] 1.2 新增 `StickerKey` 枚举与 `STICKERS` 元数据（key/中文标签/英文短句/图标 key）
- [x] 1.3 扩展 `Api` 命名空间：matches/requests/list/encouragements/ranking/profile/room-invite 的 Req/Resp 类型
- [x] 1.4 新增房间 WS 消息类型：Client（`room.create`/`room.join`/`room.utterance`/`room.leave`/`room.end`）与 Server（`room.created`/`room.joined`/`room.peer.joined`/`room.ready`/`room.turn`/`room.peer.utterance`/`room.ai.text`/`room.ai.done`/`room.peer.left`/`room.ended`/`room.error`）及各自 payload
- [x] 1.5 工具：`cefrToLevel(cefr?: string): number`（A1..C2 → 1..6，缺省视为同级）

## 2. 数据层（Prisma）

- [x] 2.1 `schema.prisma`：扩展 `User`（avatarKey/nativeLang/practiceSlot/targetScenarios/isSeed + 关系反向引用）
- [x] 2.2 `schema.prisma`：新增 `Buddy`、`BuddyRequest`、`Encouragement` 模型与索引
- [x] 2.3 `prisma migrate dev --name add_melon_buddy` 生成迁移并 `prisma generate`

## 3. 后端仓储（server/src/http/buddy.repo.ts）— TDD

- [x] 3.1 `buddy.repo.test.ts`：派生数据（本周次数/擅长场景 Top2/最近雷达/CEFR）单测（Red）
- [x] 3.2 `buddy.repo.test.ts`：匹配过滤（CEFR±1、缺省可匹配、排除自己/已是瓜友/已邀请、排序）单测（Red）
- [x] 3.3 `buddy.repo.test.ts`：邀请幂等、接受建规范化 Buddy(userA<userB)、拒绝不建关系、越权拒绝（Red）
- [x] 3.4 `buddy.repo.test.ts`：贴纸仅瓜友间、更新 lastInteractAt、接收标记已读/未读优先（Red）
- [x] 3.5 `buddy.repo.test.ts`：冷却派生（>7天 cooling、互动重置、不自动解除）（Red）
- [x] 3.6 `buddy.repo.test.ts`：排行（仅瓜友圈、本周降序、isSelf）与瓜友连胜（双方日交集连续）（Red）
- [x] 3.7 实现 `buddy.repo.ts` 让 3.1~3.6 全绿（Green）
- [x] 3.8 抽取共享日历工具（复用 `repo.ts` 的 `computeStreak`/`startOfDay`）供个人 streak 与瓜友连胜共用

## 4. 后端路由（server/src/http/buddy.routes.ts）— TDD

- [x] 4.1 `buddy.routes.test.ts`：鉴权（无 token 401）、`PUT /me/profile`、`GET /buddy/matches`（Red）
- [x] 4.2 `buddy.routes.test.ts`：requests 发起/列表/accept/decline + 越权 403（Red）
- [x] 4.3 `buddy.routes.test.ts`：list / `DELETE /buddy/:id` / encouragements 收发 / ranking（Red）
- [x] 4.4 `buddy.routes.test.ts`：room-invite 发送（仅瓜友）/ 轮询拉取（Red）
- [x] 4.5 实现 `buddy.routes.ts` 让 4.1~4.4 全绿；挂载到 `app.ts`（Green）

## 5. 实时房间（server/src/gateway）— TDD

- [x] 5.1 `ws-room.test.ts`：建房/入房鉴权、满员拒绝（Red）
- [x] 5.2 `ws-room.test.ts`：两人到齐广播 room.ready、初始轮次=创建者（Red）
- [x] 5.3 `ws-room.test.ts`：轮次仲裁——当前轮接受并广播+AI回复+切轮；非当前轮拒绝（Red）
- [x] 5.4 `ws-room.test.ts`：掉线广播 room.peer.left + 降级 solo + 空房清理（Red）
- [x] 5.5 `ws-room.test.ts`：结束时为有发言者各记一次 Session、无发言不记录（Red）
- [x] 5.6 在 `ws-gateway.ts` 新增 `rooms`/`clientRooms` 与房间消息处理，让 5.1~5.5 全绿（Green）

## 6. 种子瓜友

- [x] 6.1 `server/prisma/seed-buddies.ts`：写入 6~8 个 `isSeed` 用户（拟真 Session/radar/CEFR、avatarKey、不可登录）
- [x] 6.2 在 package.json 增加 `seed:buddies` 脚本；文档说明运行方式

## 7. 前端 API / Store

- [ ] 7.1 `web/src/api/client.ts`：新增 buddy.* 方法 + `updateProfile`
- [ ] 7.2 `web/src/store/buddy.ts`：匹配/邀请/列表/贴纸/排行状态（Zustand）+ `buddy.store.test.ts`
- [ ] 7.3 `web/src/store/settings.ts`：avatar/偏好变更后登录态同步 `PUT /me/profile`
- [ ] 7.4 `web/src/ws/room-client.ts`：房间 WS 收发封装 + 轮次状态机 + `room-client.test.ts`（mock WS）

## 8. 前端页面 / 组件

- [ ] 8.1 `web/src/pages/Buddies.tsx`：三 Tab（发现/我的瓜友/排行）+ 游客登录引导
- [ ] 8.2 组件：`BuddyCard`、`MatchFilters`、`StickerPicker`、`BuddyRanking`、`EncouragementToast`
- [ ] 8.3 `web/src/pages/LiveRoom.tsx`（`/room/:id` 全屏）：双人头像 + 轮次高亮 + AI 对话区 + 对方发言气泡 + 麦克风（非己方轮次禁用），复用现有 STT/TTS
- [ ] 8.4 `web/src/components/icons.tsx`：新增 `BuddyIcon`（melon 风格）
- [ ] 8.5 导航：Sidebar / BottomTabBar 增加「瓜友」入口
- [ ] 8.6 `web/src/App.tsx`：注册 `/buddies`（AppShell 内）与 `/room/:id`（全屏）路由

## 9. 验证

- [~] 9.1 `npm test`（server 全绿 135 项；web 待前端阶段）
- [ ] 9.2 `tsc --noEmit`（server + web）通过
- [ ] 9.3 手动联调：两浏览器登录 → 匹配 → 邀请 → 约一把 → 双排协作 → 各记一次会话 → 排行/连胜更新
- [ ] 9.4 种子瓜友在匹配/排行中可见，约练习对种子置灰
