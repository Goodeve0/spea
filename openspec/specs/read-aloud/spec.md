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
