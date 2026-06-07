# buddy-interaction Specification

## Purpose
定义瓜友贴纸与双排邀请的双向 UI 交互：全局通知、发送反馈、房间邀请横幅、约一把流程与轮询行为。

## ADDED Requirements

### Requirement: 登录用户全局轮询瓜友通知

系统 SHALL 在用户已登录时，于应用根层级（`App.tsx`，覆盖含沉浸式页面在内的全站路由）启动瓜友通知轮询。轮询 MUST 并行请求 `GET /buddy/encouragements` 与 `GET /buddy/room-invite`。未登录或处于 `/login` 时 MUST NOT 发起轮询。

前台 Tab 轮询间隔 MUST 为 **5 秒**；页面不可见（`document.hidden`）时 MUST 降频至 **15 秒**。登录成功后 MUST 立即执行一次轮询。

#### Scenario: 登录后在任意页面收到轮询

- **WHEN** 用户已登录并浏览 `/`、`/conversation` 或 `/room/:id` 任一页面
- **THEN** 系统在 5 秒内至少发起一次 encouragements 与 room-invite 请求

#### Scenario: 未登录不轮询

- **WHEN** 用户未登录或位于 `/login`
- **THEN** 系统不发起 buddy encouragements / room-invite 轮询

#### Scenario: 后台 Tab 降频

- **WHEN** 用户切换浏览器 Tab 使页面 hidden
- **THEN** 轮询间隔变为 15 秒，直至页面重新 visible

### Requirement: 接收贴纸时展示全局 Toast

当轮询返回的 `encouragements` 中存在 `read === false` 的条目时，系统 SHALL 弹出全局 toast，文案 MUST 包含发送方昵称与贴纸 label（来自 `STICKERS` 元数据）。Toast MUST 约 **3 秒**后自动消失；同一会话内同一 `encouragement.id` MUST NOT 重复弹出。

Toast 展示 MUST NOT 阻塞用户当前操作（对话、练习、导航）。

#### Scenario: 收到瓜友贴纸

- **WHEN** 瓜友 A 向用户 B 发送贴纸且 B 的轮询返回该条 `read === false`
- **THEN** B 的屏幕显示 toast，含 A 的 displayName 与贴纸 label（如「cc 给你发了「干得漂亮」」）

#### Scenario: 同一条贴纸不重复 toast

- **WHEN** 同一条 encouragement 已在当前会话展示过 toast
- **THEN** 后续轮询不再对该 id 弹出 toast

#### Scenario: 练习中可关闭贴纸 toast

- **WHEN** 用户在 `/room/:id` 或 `/conversation` 收到贴纸 toast
- **THEN** toast 正常显示且用户 MAY 点击关闭，不中断当前练习流程

### Requirement: 发送贴纸时提供即时反馈

用户在「我的瓜友」选择贴纸并发送时，系统 MUST 调用 `POST /buddy/encouragements`。成功时 SHALL 显示 toast「已发送给 {displayName}」；失败时 MUST 显示「发送失败，请重试」或等价错误提示。仅瓜友之间可发送（沿用后端 `NOT_BUDDY` 校验）。

#### Scenario: 发送成功

- **WHEN** 用户向瓜友 cc 发送 stickerKey `nice_job` 且 API 返回成功
- **THEN** 页面显示「已发送给 cc」toast，贴纸选择 UI 关闭

#### Scenario: 发送失败

- **WHEN** 用户发送贴纸但 API 返回错误或网络失败
- **THEN** 页面显示失败提示，用户 MAY 重试

#### Scenario: 非瓜友不可发送

- **WHEN** 用户尝试向非瓜友用户发送贴纸
- **THEN** 后端拒绝且前端显示失败提示（不静默失败）

### Requirement: 全局展示双排房间邀请横幅

轮询获得的 room invite MUST 合并写入全局状态（按 `roomId` 去重）。系统 SHALL 在任意页面顶部（或固定通知区）展示邀请横幅：含邀请方头像/昵称、文案「邀请你双排练习」、**加入** 与 **关闭** 操作。横幅数据 MUST 持久于前端 store，不 solely 依赖下一次 poll 响应（避免 `takeRoomInvites` 取走后 UI 丢失）。

#### Scenario: 任意页收到邀请

- **WHEN** 用户 A 约用户 B 练习且 B 的轮询返回 room invite
- **THEN** B 在当前所在页面看到邀请横幅，无需停留在 `/buddies`

#### Scenario: 点击加入进入房间

- **WHEN** 用户点击横幅「加入」
- **THEN** 浏览器导航至 `/room/{roomId}` 并触发既有 joinRoom WebSocket 流程

#### Scenario: 关闭横幅

- **WHEN** 用户点击横幅关闭
- **THEN** 该 roomId 从 pending 列表移除，横幅消失

### Requirement: 房间邀请服务端 TTL 与去重

`room-invite.store` 在添加邀请时 MUST 丢弃超过 **10 分钟** TTL 的条目。同一 `toUserId` + `roomId` MUST 去重，保留最新 `createdAt`。`takeRoomInvites` 返回的列表 MUST 仅含未过期邀请。

#### Scenario: 过期邀请不可取

- **WHEN** 邀请 createdAt 已超过 10 分钟且用户 poll room-invite
- **THEN** 该邀请不在响应列表中

#### Scenario: 重复邀请去重

- **WHEN** 同一 roomId 对同一用户连续发送两次邀请
- **THEN** 存储中仅保留一条该 roomId 记录（最新时间戳）

### Requirement: 约一把流程含场景选择与邀请方等待态

用户点击瓜友卡片「约一把」时，系统 MUST 先展示轻量 Modal 供选择场景与难度（默认取自 `localStorage` 或 `restaurant` / `beginner`）。确认后 MUST 导航至 `/room/new` 并携带 `inviteUserId`、`scenarioId`、`difficulty`。种子瓜友（`isSeed`）的「约一把」按钮 MUST 保持 disabled。

房间创建成功后 MUST 向该瓜友发送 `POST /buddy/room-invite`。邀请方在 LiveRoom 等待态（`status === 'waiting'` 且存在 invitee）MUST 显示「已邀请 {buddyName}，等待 TA 加入…」。

#### Scenario: 约一把打开场景 Modal

- **WHEN** 用户点击真实瓜友的「约一把」
- **THEN** 弹出场景/难度选择 Modal，而非直接跳转固定餐厅场景

#### Scenario: 邀请方等待文案

- **WHEN** 用户 A 创建房间并邀请 B，A 进入 LiveRoom 等待 B
- **THEN** A 看到「已邀请 B，等待 TA 加入…」（或等价含 B 昵称的文案）

#### Scenario: 种子瓜友不可约

- **WHEN** 瓜友卡片标记 `isSeed === true`
- **THEN** 「约一把」按钮 disabled，不可触发 Modal

### Requirement: 仅瓜友可触发贴纸与约一把

贴纸发送与房间邀请 MUST 满足后端 `areBuddies` 校验；前端 MUST NOT 对非瓜友展示可用「发贴纸」「约一把」（种子用户约一把除外为 disabled）。

#### Scenario: 瓜友关系校验

- **WHEN** 用户尝试向非瓜友发送 room-invite
- **THEN** API 返回 403 NOT_BUDDY，前端不展示成功态
