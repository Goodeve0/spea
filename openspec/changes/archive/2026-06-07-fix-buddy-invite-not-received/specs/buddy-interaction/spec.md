## MODIFIED Requirements

### Requirement: 登录用户全局轮询瓜友通知

系统 SHALL 在用户已登录时，于应用根层级（`App.tsx`，覆盖含沉浸式页面在内的全站路由）启动瓜友通知轮询。轮询 MUST 并行请求 `GET /buddy/encouragements` 与 `GET /buddy/room-invite`。未登录或处于 `/login` 时 MUST NOT 发起轮询。

前台 Tab 轮询间隔 MUST 为 **5 秒**；页面不可见（`document.hidden`）时 MUST 降频至 **15 秒**。登录成功后 MUST 立即执行一次轮询。

轮询失败 MUST NOT 完全静默吞掉异常。前端 MUST 区分两类错误并采取不同动作：

- **鉴权失效（HTTP 401 / `ApiError.code === 'UNAUTHORIZED'`）**：MUST 调用 `useAuthStore.logout()` 并跳转 `/login`，避免在掉线 token 上继续无效轮询；同次会话内 MUST NOT 重复跳转。
- **瞬时网络错（其他 ApiError 或 fetch reject）**：MUST 通过 `console.warn('[BuddyInboxPoller.poll] failed:', error)` 记录最后一次错误以便排查；UI MUST NOT 弹 toast（避免反复打扰用户）；下一周期继续重试。

#### Scenario: 登录后在任意页面收到轮询

- **WHEN** 用户已登录并浏览 `/`、`/conversation` 或 `/room/:id` 任一页面
- **THEN** 系统在 5 秒内至少发起一次 encouragements 与 room-invite 请求

#### Scenario: 未登录不轮询

- **WHEN** 用户未登录或位于 `/login`
- **THEN** 系统不发起 buddy encouragements / room-invite 轮询

#### Scenario: 后台 Tab 降频

- **WHEN** 用户切换浏览器 Tab 使页面 hidden
- **THEN** 轮询间隔变为 15 秒，直至页面重新 visible

#### Scenario: 鉴权失效自动登出

- **WHEN** 轮询返回 401（`ApiError.status === 401`）
- **THEN** 前端清空 token、跳转 `/login`，并停止后续轮询

#### Scenario: 瞬时网络错误不打扰用户

- **WHEN** 轮询请求 reject（如断网）或返回 5xx
- **THEN** 控制台输出 `console.warn` 记录错误对象，UI 不弹 toast，下一周期照常重试

### Requirement: 全局展示双排房间邀请横幅

轮询获得的 room invite MUST 合并写入全局状态（按 `roomId` 去重）。系统 SHALL 在任意页面顶部（或固定通知区）展示邀请横幅：含邀请方头像/昵称、文案「邀请你双排练习」、**加入** 与 **关闭** 操作。横幅数据 MUST 持久于前端 store，不 solely 依赖下一次 poll 响应（避免 `takeRoomInvites` 取走后 UI 丢失）。

由于服务端 `GET /buddy/room-invite` 在 TTL 内可重复返回同一邀请（见「房间邀请服务端 TTL 与去重」），前端 store MUST 按 `roomId` 幂等 merge：相同 `roomId` 仅保留一条，且 MUST NOT 因第二次 poll 返回同条邀请而重新弹出已被关闭的横幅。

#### Scenario: 任意页收到邀请

- **WHEN** 用户 A 约用户 B 练习且 B 的轮询返回 room invite
- **THEN** B 在当前所在页面看到邀请横幅，无需停留在 `/buddies`

#### Scenario: 点击加入进入房间

- **WHEN** 用户点击横幅「加入」
- **THEN** 浏览器导航至 `/room/{roomId}` 并触发既有 joinRoom WebSocket 流程

#### Scenario: 关闭横幅

- **WHEN** 用户点击横幅关闭
- **THEN** 该 roomId 从 pending 列表移除，横幅消失

#### Scenario: 重复 poll 同一邀请不重弹

- **WHEN** 同一 roomId 邀请在两次 5s 轮询中均被服务端返回
- **THEN** 前端 store 仍仅保留一条，已关闭的横幅 MUST NOT 重新弹出

### Requirement: 房间邀请服务端 TTL 与去重

`room-invite.store` 在添加邀请时 MUST 丢弃超过 **10 分钟** TTL 的条目。同一 `toUserId` + `roomId` MUST 去重，保留最新 `createdAt`。

`GET /buddy/room-invite` MUST 仅返回未过期且**未被该接收方标记为 delivered** 的条目。读取行为采用「读后标记 delivered」语义，而非「读后删除」：

- 同一接收方在 TTL 内多次轮询（含多 Tab / 多设备并发）MUST 均能至少读到一次该邀请；
- 一旦该接收方任一请求成功响应，对应 `(toUserId, roomId)` MUST 被标记 `delivered`，后续 GET MUST NOT 再返回同条；
- 已 delivered 的条目仍受 10 分钟 TTL 约束，到期后由现有清理逻辑移除；
- `clearRoomInvites()` 测试钩子语义不变。

#### Scenario: 过期邀请不可取

- **WHEN** 邀请 createdAt 已超过 10 分钟且用户 poll room-invite
- **THEN** 该邀请不在响应列表中

#### Scenario: 重复邀请去重

- **WHEN** 同一 roomId 对同一用户连续发送两次邀请
- **THEN** 存储中仅保留一条该 roomId 记录（最新时间戳）

#### Scenario: TTL 内同接收方多次读取均可见

- **WHEN** A 邀请 B 进 roomId=R 后 30 秒内，B 因多 Tab 触发两次 GET `/buddy/room-invite`
- **THEN** 第一次 GET 响应包含 R；第二次 GET MAY 仍返回 R（直到任一次响应被前端处理后服务端记为 delivered）

#### Scenario: 读后标记 delivered 不再返回

- **WHEN** 服务端已对 `(toUserId=B, roomId=R)` 标记 delivered
- **THEN** B 之后的 GET 响应中不再包含 R，直至 R 因新 invite 重新 add 或 TTL 过期清理

### Requirement: 约一把流程含场景选择与邀请方等待态

用户点击瓜友卡片「约一把」时，系统 MUST 先展示轻量 Modal 供选择场景与难度（默认取自 `localStorage` 或 `restaurant` / `beginner`）。确认后 MUST 导航至 `/room/new` 并携带 `inviteUserId`、`scenarioId`、`difficulty`。种子瓜友（`isSeed`）的「约一把」按钮 MUST 保持 disabled。

房间创建成功后 MUST 向该瓜友发送 `POST /buddy/room-invite`。该调用 MUST NOT 是 fire-and-forget——前端 MUST 显式 await 并按结果分支：

- **成功（HTTP 2xx）**：进入既有等待态，邀请方 LiveRoom（`status === 'waiting'` 且存在 invitee）MUST 显示「已邀请 {buddyName}，等待 TA 加入…」。
- **失败（任一非 2xx 或网络错误）**：MUST 弹错误 toast 提示用户「邀请发送失败，请重试」（或等价文案，含原因 message 时优先展示），并 `console.error('[LiveRoom.sendRoomInvite] failed:', { roomId, toUserId }, error)`；房间本身不强制销毁，邀请方可手动重试或离开。

#### Scenario: 约一把打开场景 Modal

- **WHEN** 用户点击真实瓜友的「约一把」
- **THEN** 弹出场景/难度选择 Modal，而非直接跳转固定餐厅场景

#### Scenario: 邀请方等待文案

- **WHEN** 用户 A 创建房间并邀请 B，A 进入 LiveRoom 等待 B
- **THEN** A 看到「已邀请 B，等待 TA 加入…」（或等价含 B 昵称的文案）

#### Scenario: 种子瓜友不可约

- **WHEN** 瓜友卡片标记 `isSeed === true`
- **THEN** 「约一把」按钮 disabled，不可触发 Modal

#### Scenario: 邀请发送失败 UI 反馈

- **WHEN** `POST /buddy/room-invite` 返回 403/500 或网络错
- **THEN** 邀请方页面显示「邀请发送失败，请重试」toast，控制台记录 `[LiveRoom.sendRoomInvite] failed` 含 roomId/toUserId 与原 error

#### Scenario: 邀请发送成功埋点

- **WHEN** `POST /buddy/room-invite` 返回 2xx
- **THEN** 服务端访问日志 MUST 含 fromUserId / toUserId / roomId 与当前 `(toUserId, roomId)` 的待 deliver 队列大小，便于在生产即时核查送达链路
