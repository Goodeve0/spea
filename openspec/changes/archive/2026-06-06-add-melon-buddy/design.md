## Context

哈密瓜当前为纯单人 AI 陪练。本设计在**不引入 WebRTC、不引入新第三方依赖**的前提下，新增「瓜友」结构化社交：异步关系层（匹配/卡片/邀请/贴纸/排行）+ 实时练习房间（双排协作）。

复用的现有设施：
- WS 网关 [`ws-gateway.ts`](server/src/gateway/ws-gateway.ts)：原生 `ws`，按 `msg.type` 路由，已有 `sessions`/`clientSessions` Map 与 `DialogService`/`TtsService` 注入。
- HTTP API [`app.ts`](server/src/http/app.ts) + [`data.routes.ts`](server/src/http/data.routes.ts)：Express，`requireAuth` Bearer 鉴权，Prisma `repo.ts` 数据层。
- 浏览器端 STT（Web Speech API）+ 客户端 TTS 播放 → 房间只需同步**文字**与**轮次**。
- 前端 [`api/client.ts`](web/src/api/client.ts)、Zustand stores、[`user-avatar.tsx`](web/src/components/user-avatar.tsx)（8 个系统 avatar）、雷达图组件。

## Goals / Non-Goals

**Goals**
- 仅登录用户可用；学习维度匹配；卡片只露学习数据；关系靠行为建立与冷却。
- 预置贴纸鼓励（无自由 UGC）；瓜友间排行 + 瓜友连胜。
- 实时双排协作：WS 轮次同步、AI 在环、掉线优雅降级、每人各记一次会话计入成长。
- 种子瓜友解决冷启动空窗。

**Non-Goals（本期不做）**
- WebRTC 原声、自由语音/文字 UGC、约练习/信誉分、对抗/角色互换模式、全站社区。

## 数据模型（Prisma）

> 原则：**能从 Session 派生的不冗余存**（本周练习次数、最近雷达、CEFR 取最近会话），仅新增关系与可公开 profile 字段。

### User 扩展（可公开 profile，供匹配与卡片）

```prisma
model User {
  // ...existing...
  avatarKey      String?  // 与前端 settings.avatarKey 同步，默认 'melon'
  nativeLang     String?  // 母语，可选匹配维度，如 'zh'
  practiceSlot   String?  // 练习时段偏好：'morning'|'noon'|'evening'|'night'|'any'
  targetScenarios String? // JSON 文本：目标场景 id 数组，可选匹配维度
  isSeed         Boolean  @default(false) // 种子瓜友标记
  // 关系反向引用
  buddyLinksA    Buddy[]  @relation("BuddyA")
  buddyLinksB    Buddy[]  @relation("BuddyB")
  sentRequests   BuddyRequest[] @relation("ReqFrom")
  recvRequests   BuddyRequest[] @relation("ReqTo")
  sentEnc        Encouragement[] @relation("EncFrom")
  recvEnc        Encouragement[] @relation("EncTo")
}
```

### Buddy（瓜友关系 · 单行规范化存储）

```prisma
model Buddy {
  id              String   @id @default(cuid())
  userAId         String   // 规范化：始终 userAId < userBId（字典序），保证一对一行
  userBId         String
  createdAt       DateTime @default(now())
  lastInteractAt  DateTime @default(now()) // 任一方练习/收发贴纸/同房时更新；用于冷却判定
  userA User @relation("BuddyA", fields: [userAId], references: [id], onDelete: Cascade)
  userB User @relation("BuddyB", fields: [userBId], references: [id], onDelete: Cascade)
  @@unique([userAId, userBId])
  @@index([userAId]); @@index([userBId])
}
```
- **冷却**为**派生状态**（非落库）：`now - lastInteractAt > COOL_DAYS(7)` → `cooling`；Phase 1 **不自动解除**，仅卡片提示「该一起练了 🫠」。

### BuddyRequest（瓜友邀请）

```prisma
model BuddyRequest {
  id        String   @id @default(cuid())
  fromUserId String
  toUserId   String
  status     String   @default("pending") // 'pending'|'accepted'|'declined'
  createdAt  DateTime @default(now())
  from User @relation("ReqFrom", fields: [fromUserId], references: [id], onDelete: Cascade)
  to   User @relation("ReqTo",   fields: [toUserId],   references: [id], onDelete: Cascade)
  @@unique([fromUserId, toUserId])
  @@index([toUserId, status])
}
```

### Encouragement（预置贴纸记录）

```prisma
model Encouragement {
  id         String   @id @default(cuid())
  fromUserId String
  toUserId   String
  stickerKey String   // StickerKey 枚举值
  createdAt  DateTime @default(now())
  readAt     DateTime?
  from User @relation("EncFrom", fields: [fromUserId], references: [id], onDelete: Cascade)
  to   User @relation("EncTo",   fields: [toUserId],   references: [id], onDelete: Cascade)
  @@index([toUserId, readAt])
}
```

> 实时房间**不落库**（运行时内存态），仅在房间结束时为每位参与者各写一条标准 `Session`（复用现有 `submitSession` 逻辑），从而计入成长曲线。

## 派生数据规则

- **CEFR**：取该用户最近一条 `Session.cefrEstimate`（无则 `null` → 卡片显示「评估中」）。
- **本周练习次数**：`Session` 中 `timestamp` 落在本周（周一 0 点至今）的条数。
- **擅长场景**：近 30 天 `Session` 按 `scenarioId` 计数，取 Top 2。
- **最近雷达**：最近一条 `Session.radar`。

## API 设计（HTTP，挂在 `/buddy` 前缀，全部 `requireAuth`）

| 方法/路径 | 说明 |
|---|---|
| `PUT /me/profile` | 同步可公开 profile（avatarKey/nativeLang/practiceSlot/targetScenarios） |
| `GET /buddy/matches?scenario=&slot=&lang=` | 匹配候选卡片列表（CEFR ±1 必须，其余可选过滤；排除自己/已是瓜友/已邀请） |
| `POST /buddy/requests` `{toUserId}` | 发起邀请（幂等；不可邀请自己/已是瓜友） |
| `GET /buddy/requests` | 我收到的 pending 邀请（含对方卡片） |
| `POST /buddy/requests/:id/accept` | 接受 → 建 Buddy 行，标记 accepted |
| `POST /buddy/requests/:id/decline` | 拒绝 |
| `GET /buddy/list` | 我的瓜友列表（含卡片 + 冷却状态 + 瓜友连胜天数） |
| `DELETE /buddy/:buddyId` | 解除瓜友 |
| `POST /buddy/encouragements` `{toUserId, stickerKey}` | 发送预置贴纸（更新 Buddy.lastInteractAt） |
| `GET /buddy/encouragements` | 我收到的贴纸（未读优先），并标记已读 |
| `GET /buddy/ranking` | 我与瓜友的本周练习次数排行 |

- 数据访问集中在新文件 `server/src/http/buddy.repo.ts`，路由在 `server/src/http/buddy.routes.ts`，挂载于 [`app.ts`](server/src/http/app.ts)。

## 匹配算法

```
候选 = 所有 User（含 isSeed）
  排除：自己、已是瓜友、已有 pending/accepted 邀请（任一方向）
  必须：|cefrLevel(候选) - cefrLevel(自己)| ≤ 1   // A1..C2 映射为 1..6；无 CEFR 视为同级可匹配
  可选过滤：scenario ∈ 候选.targetScenarios；slot 命中；lang 命中
排序：CEFR 距离升序 → 本周练习次数降序（活跃优先）→ 随机打散
返回：Top 20 卡片
```

## 瓜友连胜（mutual streak）

- 取双方各自的练习「自然日集合」，求交集；从今天（或昨天）起向前连续计数。复用 [`repo.ts`](server/src/http/repo.ts) `computeStreak` 的同款日历逻辑，抽为共享工具。

## 预置贴纸（StickerKey）

固定枚举（`shared/contracts.ts`），每项含 `key / 中文标签 / 英文短句 / 图标 key`：

```
nice_job        干得漂亮     "Nice job!"
keep_going      继续加油     "Keep going!"
one_more_melon  再来一颗瓜   "One more melon!"
well_done       太棒了       "Well done!"
impressive      厉害了       "Impressive!"
proud_of_you    为你骄傲     "Proud of you!"
```
- 发送仅记录 `stickerKey`；接收方可点击用**现有 `tts.request` 通道**朗读英文短句（复用，不新增 TTS 设施）。Phase 1 无自由录音/文字。

## 实时练习房间（WS 协议）

### 房间状态机（服务端内存）

```
[created] --peer join--> [waiting(1人)] --2人到齐--> [active] --结束/全员离开--> [ended]
                                              |
                                  一方掉线 --> [degraded] --剩余者继续solo/退出--> [ended]
```

### 房间内存结构（WsGateway 新增）

```ts
interface RoomState {
  id: string;
  scenarioId: string; difficulty: Difficulty;
  members: { userId: string; ws: WebSocket; displayName: string; avatarKey: string }[];
  turns: Turn[];              // 共享对话历史（两人 + AI），喂给 dialogService
  currentTurnUserId: string;  // 轮次仲裁
  perUserTurns: Map<userId, Turn[]>; // 各自的 user turn，用于结束时各记一次 Session
}
private rooms = new Map<string, RoomState>();
private clientRooms = new Map<WebSocket, string>();
```

### WS 消息（新增到 `shared/contracts.ts` 的 Client/Server 类型）

客户端 → 服务端：
- `room.create` `{token, scenarioId, difficulty}` → 建房，创建者入房，返回 roomId
- `room.join` `{token, roomId}` → 加入已有房间（鉴权 + 校验未满）
- `room.utterance` `{text}` → 当前轮用户提交本地 STT 文字
- `room.leave` `{}` → 主动离开
- `room.end` `{}` → 结束房间

服务端 → 客户端：
- `room.created` `{roomId}`
- `room.joined` `{roomId, members[]}` / `room.peer.joined` `{member}`
- `room.ready` `{greeting, currentTurnUserId}`（两人到齐，AI 开场）
- `room.turn` `{currentTurnUserId}`（轮次变更广播）
- `room.peer.utterance` `{userId, text}`（对方发言广播给另一人）
- `room.ai.text` `{deltaText}` / `room.ai.done`（AI 流式回复，广播全员；音频走各自 `tts.request`）
- `room.peer.left` `{userId}` → 进入 degraded
- `room.ended` `{}`
- `room.error` `{code, message}`

### 轮次流程（协作模式）

```
两人到齐 → AI 开场(greet) → currentTurn = 创建者
当前轮用户说话 → 本地 STT → room.utterance{text}
  服务端校验「确实是该用户的轮次」(否则 room.error)
  → 追加到 turns & 该用户 perUserTurns
  → 广播 room.peer.utterance 给另一人
  → dialogService.reply(房间共享上下文) 流式 → 广播 room.ai.text / room.ai.done
  → currentTurn 切换到另一人 → 广播 room.turn
循环。任一人 room.end / 全员离开 → 为每个 member 各生成一次 Session（基于其 perUserTurns）→ room.ended
```

### 掉线降级

- `ws.on('close')` 若属于房间：广播 `room.peer.left`，房间转 `degraded`；剩余者可继续与 AI solo（轮次恒为自己）或 `room.end`。
- 若房间空 → 清理。

### 房间鉴权

- `room.create`/`room.join` 携带 `token`，服务端用现有 `verifyToken`（[`auth.service`](server/src/http/auth.service.ts)）解析 userId；失败回 `room.error UNAUTHORIZED`。
- 入房邀请：发起方 `room.create` 得到 roomId，通过 HTTP `POST /buddy/encouragements` 之外另设轻量「房间邀请」——Phase 1 简化为**前端把 roomId 通过 `POST /buddy/requests` 同类的一次性通知**或直接分享链接 `/room/:id`；瓜友在「我的瓜友」点「约一把」即调 `room.create` 并把 roomId 推给对方（通过新增 `POST /buddy/room-invite {toUserId, roomId}` + 对方轮询 `GET /buddy/room-invite`）。

## 前端设计

### 路由

- `/buddies`（AppShell 内）：三 Tab — **发现**（匹配卡片 + 筛选）/ **我的瓜友**（列表 + 冷却提示 + 贴纸 + 约练习）/ **排行**。
- `/room/:id`（全屏，AppShell 外，仿 [`Conversation.tsx`](web/src/pages/Conversation.tsx)）：顶部双人头像 + 轮次高亮 + 场景标题；中部 AI 对话区 + 对方发言气泡（文字）；底部「轮到你说」麦克风（非自己轮次禁用）；**无文字聊天框**。

### 组件

- `BuddyCard`：avatar + 昵称 + CEFR + 本周次数 + 擅长场景 + 最近雷达 mini 图；按钮「邀请成为瓜友 / 约一把 / 发贴纸」。
- `MatchFilters`：场景 / 时段 / 母语 可选筛选。
- `StickerPicker`：预置贴纸网格。
- `BuddyRanking`：本周次数排行（含我自己高亮）。
- `EncouragementToast`：收到贴纸的提示（点击朗读）。

### Store / API

- 扩展 [`api/client.ts`](web/src/api/client.ts)：buddy.* 方法 + `updateProfile`。
- 新增 `web/src/store/buddy.ts`（Zustand）：匹配/邀请/列表/贴纸/排行状态。
- 新增 `web/src/ws/room-client.ts`：封装房间 WS 收发（复用现有 WS 连接封装思路）。
- profile 同步：[`settings.ts`](web/src/store/settings.ts) `setAvatarKey` 等变更后，登录态下调用 `PUT /me/profile`。

### 导航入口

- Sidebar / BottomTabBar 增加「瓜友」入口（新图标 BuddyIcon，melon 风格）。
- 游客点击 → 引导登录解锁。

## 测试策略（TDD）

- **后端单测**（vitest）：`buddy.repo.test.ts`（匹配过滤/CEFR±1/排除已有关系/连胜计算/冷却派生）、`buddy.routes.test.ts`（鉴权/邀请幂等/越权拒绝/贴纸已读）、`ws-room.test.ts`（建房/入房/轮次仲裁/非己方轮次拒绝/掉线降级/结束各记一次 Session）。
- **前端单测**：`buddy.store.test.ts`、`room-client.test.ts`（mock WS，验证轮次状态机与禁用麦克风逻辑）。
- 外部 AI 全部可 mock（沿用现有 dialogService mock 约定）。

## 迁移与风险

- **Prisma 迁移**：新增 4 模型 + User 字段 → `prisma migrate dev`。`avatarKey` 等可空，老用户无影响。
- **WS 无鉴权历史**：房间通道引入 token 校验，不影响既有单人 `session.*` 通道。
- **冷启动**：种子脚本 `server/prisma/seed-buddies.ts` 写入 6~8 个 `isSeed` 用户（含拟真 Session/radar/CEFR），让匹配与排行非空。种子用户**不可登录**（无有效 passwordHash），不进入实时房间（约练习对其置灰）。
- **隐私**：卡片不含 email/真人照片；`practiceSlot` 为粗粒度枚举，不暴露精确作息。

## 决策记录（关键取舍）

1. **文字同步房间而非 WebRTC**：复用现有栈、零新依赖；代价是双排听不到原声（后续阶段再上 WebRTC）。
2. **关系单行规范化（userAId<userBId）**：避免双向行不一致；查询时按当前用户归一化展示。
3. **房间运行时不落库，结束各记一次 Session**：双排也能计入个人成长，且不污染历史数据模型。
4. **Phase 1 仅协作模式**：最安全、对焦虑用户友好；角色互换/对抗复用同一房间设施后续接入。
