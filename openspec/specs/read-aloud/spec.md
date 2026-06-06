# read-aloud Specification

## Purpose
为对话页每条 AI 消息气泡下方提供按需朗读按钮，让用户可重播任意 AI 回复，使用当前 TTS 引擎（浏览器或讯飞），支持播放/停止切换与按钮激活态同步。
## Requirements
### Requirement: AI 消息气泡下方显示朗读按钮

每条 AI turn 的气泡下方 SHALL 渲染一个喇叭图标按钮（🔈）。点击按钮 SHALL 使用当前激活的 TTS 引擎朗读该条消息的文本。用户消息 MUST NOT 显示朗读按钮。

#### Scenario: 点击 AI 消息朗读按钮
- **WHEN** 用户点击某条 AI 消息气泡下方的朗读按钮
- **THEN** 当前 TTS 引擎开始朗读该消息文本，按钮变为激活态（🔊 正在朗读…）

#### Scenario: 用户消息无朗读按钮
- **WHEN** 渲染用户发言的消息气泡
- **THEN** 气泡下方不渲染朗读按钮

### Requirement: 播放/停止切换

点击正在播放的消息的朗读按钮 SHALL 停止播放。任意时刻全部对话中最多只有一条消息处于"朗读中"状态。

#### Scenario: 点击同一按钮停止
- **WHEN** 某条消息正在朗读，用户再次点击同一条消息的按钮
- **THEN** TTS 引擎停止，按钮恢复空闲态（🔈 朗读）

#### Scenario: 点击其他消息切换
- **WHEN** 消息 A 正在朗读，用户点击消息 B 的朗读按钮
- **THEN** 消息 A 的播放先停止，消息 B 开始朗读，消息 B 的按钮变为激活态

### Requirement: 按钮状态与 AI 自动朗读同步

AI 回复生成后自动朗读期间，对应消息的朗读按钮 SHALL 同步显示激活态（🔊 正在朗读…）。朗读结束后按钮 SHALL 恢复空闲态。

#### Scenario: AI 自动朗读时按钮亮起
- **WHEN** AI 新回复入库并开始自动朗读
- **THEN** 该条 AI 消息的朗读按钮立即进入激活态，显示「🔊 正在朗读…」

#### Scenario: 自动朗读结束后按钮恢复
- **WHEN** AI 自动朗读的 `onEnd` 回调触发
- **THEN** 对应消息的朗读按钮恢复为空闲态「🔈 朗读」

### Requirement: LLM 生成期间禁用朗读按钮

当 LLM 正在生成 token（`isLoading = true`）时，所有朗读按钮 SHALL 处于 disabled 状态。生成完成后恢复可点击。

#### Scenario: 生成中按钮置灰
- **WHEN** 用户发送消息后，LLM 尚未返回完整回复
- **THEN** 所有已有消息的朗读按钮 disabled，不可点击

### Requirement: 复用现有 TTS 引擎

朗读功能 SHALL 调用 `ITtsEngine.speak(text, options)` 接口，不新增引擎方法或 WebSocket 消息类型。

#### Scenario: 使用浏览器引擎朗读
- **WHEN** 当前激活引擎为 `browser`，用户点击朗读按钮
- **THEN** 调用 `BrowserSpeechSynthesisEngine.speak(text, { onEnd })` 完成朗读

#### Scenario: 使用讯飞引擎朗读
- **WHEN** 当前激活引擎为 `iflytek`，用户点击朗读按钮
- **THEN** 调用 `IflytekTtsEngine.speak(text, { onEnd })`，引擎内部通过现有 WebSocket 通道处理请求

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

### Requirement: 进入对话页自动朗读必须可靠发声

进入对话页时，系统继续按现有 UX 自动朗读 AI 开场白。`BrowserSpeechSynthesisEngine.speak()` MUST 在内部对常见的"挂起 / 静默吞掉"场景做有限重试与超时兜底，使**正常环境下用户能听到开场白**、**异常环境下也不会出现"显示正在朗读但完全没声音且不复位"的卡死**。

启动失败终态必须导致：UI 的 `readingTurnId` 复位为 `null`，对应消息的朗读按钮恢复空闲态（🔈 朗读），`isAiSpeaking` 设为 `false`。

#### Scenario: 进入页面正常发声
- **WHEN** 用户进入对话页，浏览器与音频环境正常
- **THEN** 在 1.5 秒内开始朗读开场白文字，对应朗读按钮显示为激活态（🔊 正在朗读…）

#### Scenario: 浏览器初次静默吞掉 speak 时由重试恢复
- **WHEN** 用户进入对话页，第一次 `speak()` 调用后 1500ms 内未触发 `onstart`
- **THEN** 引擎自动 `cancel() + resume()` 后重建 utterance 重新 `speak()`，不向上层抛 `onError`；若重试后开始发声，用户最终听到开场白

#### Scenario: 启动重试全部失败时 UI 自动复位
- **WHEN** `speak()` 经过最多 2 次重试（合计最长约 4.5 秒）仍未发声
- **THEN** 引擎调用 `onError(new Error('SpeechSynthesis start timeout'))` 与 `onEnd()`；上层 `Conversation.speakReply` 的 `onError` 路径将 `readingTurnId` 置为 `null`、按钮恢复空闲态、`isAiSpeaking` 置为 `false`，UI 不再卡死

#### Scenario: 用户在重试期间打断时不被旧重试链覆盖
- **WHEN** 引擎正处于启动重试等待中（尚未发声），用户点击麦克风开始录音或发送文字
- **THEN** `stop()` 递增播放代际，所有挂起的重试 setTimeout 与未发出的新 utterance MUST 通过代际守卫被静默丢弃，不会出现"打断后旧开场白突然开始朗读"

