# melon-buddy-encouragement Specification

## Purpose
定义瓜友之间的**预置贴纸鼓励**：仅系统预置内容，无自由录音/文字 UGC，从根源杜绝骚扰与审核成本。

## ADDED Requirements

### Requirement: 预置贴纸枚举

系统 SHALL 在 `shared/contracts.ts` 定义固定的 `StickerKey` 枚举，每项含 `key / 中文标签 / 英文短句 / 图标 key`。Phase 1 MUST NOT 提供任何自由录音或自由文字输入。

#### Scenario: 贴纸为闭合集合
- **WHEN** 前端渲染贴纸选择器
- **THEN** 仅展示 `StickerKey` 枚举内的预置项，无自由输入框

#### Scenario: 拒绝非法 stickerKey
- **WHEN** 客户端提交不在枚举内的 `stickerKey`
- **THEN** 接口返回错误，不创建记录

### Requirement: 发送贴纸仅限瓜友之间

登录用户 SHALL 能 `POST /buddy/encouragements {toUserId, stickerKey}` 向**已是瓜友**的对象发送贴纸。向非瓜友发送 MUST 被拒绝。发送成功 MUST 更新双方 `Buddy.lastInteractAt`。

#### Scenario: 向瓜友发送贴纸
- **WHEN** A 与 B 为瓜友，A 发送 `nice_job` 给 B
- **THEN** 创建 `Encouragement(from=A,to=B,stickerKey=nice_job)`，并更新关系 `lastInteractAt`

#### Scenario: 向非瓜友发送被拒
- **WHEN** A 与 C 非瓜友，A 尝试发送贴纸给 C
- **THEN** 返回错误，不创建记录

### Requirement: 接收与已读

登录用户 SHALL 能 `GET /buddy/encouragements` 获取自己收到的贴纸（未读优先，按时间倒序）。读取后对应记录 MUST 被标记 `readAt`。

#### Scenario: 拉取并标记已读
- **WHEN** B 收到 A 的贴纸后调用 `GET /buddy/encouragements`
- **THEN** 返回该贴纸，且其 `readAt` 被设置为当前时间

#### Scenario: 未读优先
- **WHEN** B 同时有未读与已读贴纸
- **THEN** 未读贴纸排在已读之前

### Requirement: 贴纸语音播放复用现有 TTS

接收方点击贴纸时，前端 SHALL 通过现有 `tts.request` WS 通道朗读该贴纸的英文短句。本能力 MUST NOT 引入新的 TTS 设施。

#### Scenario: 点击贴纸朗读
- **WHEN** B 点击收到的 `nice_job` 贴纸
- **THEN** 通过 `tts.request` 合成并播放 "Nice job!"
