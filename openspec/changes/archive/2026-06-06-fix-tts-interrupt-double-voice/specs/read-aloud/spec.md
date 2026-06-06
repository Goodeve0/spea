# read-aloud Specification

## Purpose
为对话页 AI 消息提供按需朗读、播放/停止切换、与 AI 自动朗读的状态同步，以及打断后的状态复位。

## ADDED Requirements

### Requirement: 用户打断 AI 自动朗读

当 AI 消息处于自动朗读（`speakReply`）期间，用户通过开始录音（点击麦克风）或发送文字消息打断时，系统 MUST 立即停止当前 TTS 播放，并将 `readingTurnId` 置为 `null`、`isAiSpeaking` 置为 `false`。被打断消息的朗读按钮 MUST 立即恢复空闲态（🔈 朗读）。

#### Scenario: 录音打断自动朗读
- **WHEN** AI 消息 M 正在自动朗读且 M 的朗读按钮为激活态，用户点击麦克风开始录音
- **THEN** TTS 立即停止，M 的朗读按钮恢复空闲态，`readingTurnId` 为 `null`

#### Scenario: 发送文字打断自动朗读
- **WHEN** AI 消息 M 正在自动朗读，用户通过文字输入发送新消息
- **THEN** TTS 立即停止，M 的朗读按钮恢复空闲态，随后 LLM 处理新消息

#### Scenario: 打断后新回复朗读不叠音
- **WHEN** 用户打断 M1 的自动朗读并完成新一轮对话，AI 新回复 M2 开始自动朗读
- **THEN** 用户仅听到 M2 的音频，M1 的朗读按钮保持空闲态，M2 的朗读按钮为激活态

### Requirement: 打断后 stale 回调不复位按钮

若用户在 AI 自动朗读期间打断，随后旧会话的 `onEnd` 因异步延迟到达，系统 MUST NOT 将 `readingTurnId` 或朗读按钮状态恢复为「正在朗读」旧消息。

#### Scenario: 打断后旧 onEnd 忽略
- **WHEN** 用户打断 M1 自动朗读，`readingTurnId` 已清空，随后 M1 的旧 `onEnd` 回调触发
- **THEN** `readingTurnId` 保持 `null`，M1 按钮保持空闲态，不触发新的 `speak`

#### Scenario: 讯飞兜底前已打断则不播放
- **WHEN** M1 自动朗读期间用户已打断，随后讯飞引擎异步返回 `onError` 并尝试浏览器兜底朗读 M1
- **THEN** 浏览器兜底 MUST NOT 启动，用户听不到 M1 的任何后续音频
