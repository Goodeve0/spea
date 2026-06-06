# melon-buddy-live-room Specification

## Purpose
定义实时练习房间（双排 · 协作模式）：基于现有 WS 的房间生命周期、入房（邀请/轮询）、轮次同步、AI 在环、掉线降级，以及结束时为每位参与者各记一次会话。**不引入 WebRTC**，搭子之间以文字呈现彼此发言。

## ADDED Requirements

### Requirement: 房间创建与鉴权入房

登录用户 SHALL 能通过 WS `room.create {token, scenarioId, difficulty}` 创建房间并入房，服务端返回 `room.created {roomId}`。其他用户 SHALL 能通过 `room.join {token, roomId}` 加入。`token` MUST 经现有 `verifyToken` 校验；校验失败 MUST 回 `room.error UNAUTHORIZED`。房间满（2 人）后再加入 MUST 回 `room.error`。

#### Scenario: 创建房间
- **WHEN** 已登录 A 发送 `room.create`
- **THEN** 服务端建房，A 入房，返回 `room.created {roomId}`

#### Scenario: 无效 token 入房被拒
- **WHEN** 客户端 `room.join` 携带无效 token
- **THEN** 回 `room.error UNAUTHORIZED`，不入房

#### Scenario: 满员拒绝加入
- **WHEN** 房间已有 2 名成员，第 3 人尝试 `room.join`
- **THEN** 回 `room.error`，不入房

### Requirement: 房间邀请（轮询送达）

发起方创建房间后 SHALL 能通过 `POST /buddy/room-invite {toUserId, roomId}` 向瓜友发送一次性入房邀请；被邀请方通过 `GET /buddy/room-invite` 轮询获取待入房邀请。仅瓜友之间可发送房间邀请。

#### Scenario: 邀请瓜友入房
- **WHEN** A 创建房间后对瓜友 B 调用 `POST /buddy/room-invite`
- **THEN** B 轮询 `GET /buddy/room-invite` 可获得该 roomId

#### Scenario: 非瓜友不可邀请
- **WHEN** A 对非瓜友 C 发送房间邀请
- **THEN** 返回错误，C 收不到邀请

### Requirement: 两人到齐开场

当房间成员达到 2 人时，服务端 SHALL 生成 AI 开场白并广播 `room.ready {greeting, currentTurnUserId}`，初始轮次 MUST 指向房间创建者。

#### Scenario: 到齐后 AI 开场
- **WHEN** B 加入 A 创建的房间，成员达 2 人
- **THEN** 广播 `room.ready`，含 AI 开场白，`currentTurnUserId` 为 A

### Requirement: 轮次仲裁与发言广播

服务端 SHALL 维护 `currentTurnUserId`。仅当前轮用户的 `room.utterance {text}` 被接受；非当前轮用户提交 MUST 被拒绝（`room.error`）。接受后服务端 MUST：将文字加入共享对话历史与该用户的个人轮次；广播 `room.peer.utterance {userId, text}` 给另一成员；调用对话服务流式生成 AI 回复并广播 `room.ai.text`/`room.ai.done`；随后把轮次切换给另一成员并广播 `room.turn {currentTurnUserId}`。

#### Scenario: 当前轮用户发言
- **WHEN** 轮次为 A，A 发送 `room.utterance {text:"I'd like a table"}`
- **THEN** 广播 A 的发言给 B，AI 流式回复广播全员，随后轮次切到 B 并广播 `room.turn`

#### Scenario: 非当前轮用户发言被拒
- **WHEN** 轮次为 A，B 发送 `room.utterance`
- **THEN** 回 `room.error`，不影响对话历史与轮次

#### Scenario: AI 基于共享上下文回复
- **WHEN** A、B 先后发言
- **THEN** AI 的回复基于包含两人发言的共享对话历史生成

### Requirement: 无文字聊天框

房间内成员之间 MUST NOT 存在自由文字聊天通道。`room.utterance` MUST 仅来源于本地语音识别（STT）结果，唯一沟通方式是说英语。

#### Scenario: 无人际文字输入
- **WHEN** 用户处于房间页
- **THEN** 界面无文字聊天输入框，只有麦克风发言

### Requirement: 掉线优雅降级

当一名成员的 WS 断开时，服务端 SHALL 广播 `room.peer.left {userId}`，房间进入降级态。剩余成员 SHALL 可选择继续与 AI 单人练习（轮次恒为自己）或结束房间。房间为空时 MUST 被清理。

#### Scenario: 一方掉线通知对方
- **WHEN** B 的连接断开
- **THEN** A 收到 `room.peer.left {userId:B}`，房间转降级态

#### Scenario: 剩余者继续 solo
- **WHEN** 降级后 A 选择继续
- **THEN** 轮次恒为 A，可继续与 AI 对话

#### Scenario: 房间空被清理
- **WHEN** 房间内最后一名成员离开
- **THEN** 服务端清理该房间内存状态

### Requirement: 结束后各记一次会话

房间通过 `room.end` 或全员离开而结束时，服务端 SHALL 为每位**有发言**的参与者基于其个人轮次各生成并写入一条标准 `Session`（复用现有会话提交逻辑），使双排练习计入各自成长曲线。无发言的参与者 MUST NOT 被记录会话。

#### Scenario: 双方均有发言各记一次
- **WHEN** A、B 在房间内均有发言，随后 `room.end`
- **THEN** 为 A、B 各写入一条 Session，分别计入各自成长

#### Scenario: 无发言不记录
- **WHEN** C 全程未发言便离开
- **THEN** 不为 C 写入任何 Session

#### Scenario: 结束广播
- **WHEN** 房间结束
- **THEN** 向仍在房的成员广播 `room.ended`
