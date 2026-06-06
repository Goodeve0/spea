# melon-buddy-relationship Specification

## Purpose
定义瓜友关系的建立（邀请/接受/拒绝）、解除与**冷却**机制——关系靠行为建立与维系，而非加好友聊天。

## ADDED Requirements

### Requirement: 邀请成为瓜友

登录用户 SHALL 能通过 `POST /buddy/requests {toUserId}` 向候选发起瓜友邀请，生成 status=`pending` 的 `BuddyRequest`。用户 MUST NOT 邀请自己，也 MUST NOT 对已是瓜友者重复邀请。

#### Scenario: 发起邀请
- **WHEN** 用户 A 向候选 B 发起邀请
- **THEN** 创建一条 `from=A,to=B,status=pending` 的邀请记录

#### Scenario: 不可邀请自己
- **WHEN** 用户 A 的 `toUserId` 为自身 id
- **THEN** 接口返回错误，不创建邀请

#### Scenario: 邀请幂等
- **WHEN** 用户 A 对已存在 pending 邀请的 B 再次发起邀请
- **THEN** 不重复创建，返回已存在的邀请

### Requirement: 接受 / 拒绝邀请

被邀请方 SHALL 能 `POST /buddy/requests/:id/accept` 或 `/decline`。接受 MUST 创建一条规范化 `Buddy` 关系（`userAId < userBId`）并将邀请标记 accepted；拒绝 MUST 标记 declined 且不创建关系。仅被邀请方（`toUserId`）有权操作。

#### Scenario: 接受邀请建立关系
- **WHEN** B 接受来自 A 的邀请
- **THEN** 创建 `Buddy(userAId=min(A,B), userBId=max(A,B))`，邀请变为 accepted

#### Scenario: 拒绝邀请不建立关系
- **WHEN** B 拒绝来自 A 的邀请
- **THEN** 邀请变为 declined，无 `Buddy` 行被创建

#### Scenario: 越权操作被拒
- **WHEN** 非被邀请方 C 尝试接受 A→B 的邀请
- **THEN** 返回 403，邀请状态不变

### Requirement: 查看收到的邀请

登录用户 SHALL 能 `GET /buddy/requests` 获取自己收到的 pending 邀请列表，每条附带发起方的瓜友卡片（只露学习数据）。

#### Scenario: 列出待处理邀请
- **WHEN** A 已向 B 发起邀请，B 调用 `GET /buddy/requests`
- **THEN** 返回包含 A 卡片的 pending 邀请

### Requirement: 查看与解除瓜友

登录用户 SHALL 能 `GET /buddy/list` 获取瓜友列表（含卡片、冷却状态、瓜友连胜天数），并能 `DELETE /buddy/:buddyId` 解除关系。仅关系参与方有权解除。

#### Scenario: 列出瓜友
- **WHEN** A 与 B 已是瓜友，A 调用 `GET /buddy/list`
- **THEN** 返回包含 B 卡片、冷却状态与连胜天数的条目

#### Scenario: 解除瓜友
- **WHEN** A 对与 B 的关系调用 `DELETE /buddy/:buddyId`
- **THEN** 该 `Buddy` 行被删除，双方互不再为瓜友

#### Scenario: 非参与方不可解除
- **WHEN** 用户 C 尝试删除 A-B 的关系
- **THEN** 返回 403，关系不变

### Requirement: 关系冷却为派生状态

瓜友关系的「冷却」MUST 为派生状态，不落库：当 `now - Buddy.lastInteractAt > COOL_DAYS`（默认 7 天）时，关系在列表中标记为 `cooling`。Phase 1 MUST NOT 自动解除冷却关系，仅作提示。`lastInteractAt` SHALL 在以下行为发生时更新：任一方完成练习、收发贴纸、同房练习。

#### Scenario: 长期无互动进入冷却
- **WHEN** A-B 关系的 `lastInteractAt` 距今超过 7 天
- **THEN** 列表中该关系标记为 cooling，并显示「该一起练了」提示

#### Scenario: 互动重置冷却
- **WHEN** A 向 B 发送一张贴纸
- **THEN** `lastInteractAt` 更新为当前时间，关系恢复 active

#### Scenario: 冷却不自动解除
- **WHEN** 关系冷却超过任意时长
- **THEN** 关系仍然存在，不被系统自动删除
