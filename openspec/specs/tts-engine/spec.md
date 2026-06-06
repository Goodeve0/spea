# tts-engine Specification

## Purpose
TBD - created by archiving change add-iflytek-tts. Update Purpose after archive.
## Requirements
### Requirement: 引擎接口抽象

前端 SHALL 提供 `ITtsEngine` 接口，所有 TTS 实现 MUST 满足该契约。接口至少包含 `speak(text: string, onEnd?: () => void): void`、`stop(): void`、`isAvailable(): boolean | Promise<boolean>`、`dispose(): void` 四个方法。

#### Scenario: 浏览器引擎实现接口
- **WHEN** 调用 `BrowserSpeechSynthesisEngine.isAvailable()`
- **THEN** 返回 `'speechSynthesis' in window` 的判断结果

#### Scenario: 讯飞引擎实现接口
- **WHEN** 调用 `IflytekTtsEngine.speak(text, onEnd)`
- **THEN** 引擎通过 WebSocket 向后端发送 `tts.request`，接收音频帧并播放，播放完毕调用 `onEnd`

### Requirement: 引擎注册表与工厂

前端 SHALL 维护一个引擎注册表（`Map<EngineId, ITtsEngine>`），通过 `getCurrentEngine()` 函数返回当前激活引擎实例。`EngineId` MUST 为字面量联合类型 `'browser' | 'iflytek'`。

#### Scenario: 默认引擎为 browser
- **WHEN** 用户未设置过偏好（`localStorage` 无 `ttsEngine` 键）
- **THEN** `getCurrentEngine()` 返回 `BrowserSpeechSynthesisEngine` 实例

#### Scenario: 切换为讯飞引擎
- **WHEN** 设置 store 中 `ttsEngine` 被改为 `'iflytek'`
- **THEN** 后续 `getCurrentEngine()` 调用返回 `IflytekTtsEngine` 实例

### Requirement: 引擎切换中断保护

切换引擎时 SHALL 先停止旧引擎正在播放的音频，再让新引擎接管后续 `speak` 调用。MUST NOT 出现两个引擎同时发声。

#### Scenario: 播放中切换
- **WHEN** 浏览器引擎正在朗读，用户在设置面板切到讯飞
- **THEN** 浏览器引擎立即静音；新发起的句子由讯飞朗读

### Requirement: 引擎不可用时的回退

当 `getCurrentEngine()` 返回的引擎 `isAvailable()` 为 false 时，调用方 MUST 自动回退到 `BrowserSpeechSynthesisEngine`，并通过 toast 或 console.warn 提示用户。

#### Scenario: 讯飞 key 缺失
- **WHEN** 用户选择讯飞引擎，但后端 `.env` 未配置讯飞三件套
- **THEN** 第一次 `speak()` 后 5 秒内未收到首帧，前端回退到浏览器引擎并提示 "讯飞 TTS 不可用，已切回浏览器朗读"

### Requirement: 打断与单声源保护

任意时刻系统 MUST NOT 出现两个 TTS 播放会话同时可听（含同一引擎内连续 `speak`、用户打断后继续对话、讯飞失败兜底到浏览器引擎）。每次新 `speak()` 开始前，引擎 MUST 先停止当前会话；`stop()` 调用后 MUST 立即停止一切可听输出，且旧会话的 `onEnd` / `onError` 回调 MUST NOT 再触发新的播放或 UI 状态变更。

各引擎实现 MUST 使用内部播放代际（generation）机制：`stop()` 或新 `speak()` 使进行中的代际失效，所有异步出口（utterance 事件、WS 音频帧入队、`scheduleEnd` 定时器）在代际不匹配时 MUST 静默丢弃。

#### Scenario: 播放中调用 stop 立即静音
- **WHEN** 浏览器或讯飞引擎正在朗读文本，调用方调用 `engine.stop()`
- **THEN** 用户立即听不到该会话的后续音频输出

#### Scenario: stop 后 onEnd 不触发
- **WHEN** 引擎正在朗读且调用方已注册 `onEnd` 回调，随后调用 `engine.stop()` 且未发起新 `speak()`
- **THEN** 旧会话的 `onEnd` MUST NOT 被调用

#### Scenario: 连续 speak 仅最后一次可听
- **WHEN** 引擎正在朗读句子 A，调用方在不等待 A 结束的情况下调用 `speak(句子 B)`
- **THEN** 句子 A 的音频立即停止，仅句子 B 可听，且仅句子 B 的 `onEnd` 在播放结束后触发

#### Scenario: 讯飞 stop 后迟到 WS 帧被忽略
- **WHEN** 讯飞引擎正在播放 `requestId=R1`，调用 `stop()` 后后端仍推送 `R1` 的 `tts.audio` 帧
- **THEN** 帧 MUST NOT 入队播放，用户听不到 R1 的残留音频

#### Scenario: 浏览器 cancel 后 stale 事件被忽略
- **WHEN** 浏览器引擎正在朗读，调用 `stop()`（内部 `speechSynthesis.cancel()`）后浏览器仍触发旧 utterance 的 `onend` 或 `interrupted` 事件
- **THEN** 旧 utterance 注册的 `onEnd` / `onError` MUST NOT 被调用

#### Scenario: 打断后继续对话无叠音
- **WHEN** AI 正在自动朗读消息 M1，用户通过开始录音或发送文字打断，随后 LLM 返回新回复并开始朗读 M2
- **THEN** M1 的音频已完全停止，用户仅听到 M2 的朗读，无两个声音叠加

### Requirement: 全局 stopAll 协调

对话页在发起新朗读或用户打断时，SHALL 依次调用已注册的全部引擎（`browser` 与 `iflytek`）的 `stop()`，而不仅停止当前激活引擎。此行为 MUST 与「引擎切换中断保护」一并保证全局单声源。

#### Scenario: 打断时双引擎均 stop
- **WHEN** 当前激活引擎为讯飞且浏览器引擎因兜底曾启动过播放，用户触发打断
- **THEN** `getEngine('browser').stop()` 与 `getEngine('iflytek').stop()` 均被调用

#### Scenario: 新 speak 前双引擎均 stop
- **WHEN** 对话页即将调用 `speakReply` 朗读新 AI 回复
- **THEN** 在 `engine.speak()` 之前，两引擎的 `stop()` 均已被调用（或由 speak 内部的 stop 链等效保证无残留播放）

### Requirement: speak() 启动超时兜底

`ITtsEngine.speak()` 的实现 SHALL 在调用底层播放 API 后启动一个启动超时计时器（浏览器引擎 `BROWSER_START_TIMEOUT_MS = 1500ms`，讯飞引擎 `IFLYTEK_START_TIMEOUT_MS = 3000ms`）。若在超时窗口内未真实开始发声（浏览器引擎以 `utterance.onstart` 为准；讯飞引擎以首帧音频实际入队播放为准），引擎 MUST 视为本次启动失败，按下文规则进入重试或终态错误流程。若启动事件按时到达，超时计时器 MUST 被清除。

#### Scenario: 正常启动不误杀
- **WHEN** 引擎在启动超时窗口内收到 `onstart`（或讯飞收到首帧音频）
- **THEN** 启动超时计时器被清除，本次 `speak()` 按正常流程播放结束并触发 `onEnd`，`onError` MUST NOT 被调用

#### Scenario: 讯飞 WS 连上但未发声
- **WHEN** 讯飞引擎成功建立 WS 连接但 3000ms 内未收到首帧 `tts.audio`
- **THEN** 引擎自动结束本次会话并调用 `onError` 与 `onEnd`，上层得以走兜底分支或复位 UI

### Requirement: 浏览器引擎启动失败时自动重试

`BrowserSpeechSynthesisEngine.speak()` 在启动超时未触发 `onstart` 时 MUST NOT 直接放弃，而是按以下顺序做有限重试：

1. 累计重试次数 < `MAX_START_RETRIES`（值为 2）：调用 `speechSynthesis.cancel()` 清队列、`speechSynthesis.resume()` 解 paused 态，**重建一份新的 `SpeechSynthesisUtterance`**（同 text/voice/rate/pitch），通过 `setTimeout(0)` 延后一拍再 `speechSynthesis.speak(newUtterance)`，并重启启动计时器。
2. 累计重试次数 ≥ `MAX_START_RETRIES`：调用 `opts.onError?.(new Error('SpeechSynthesis start timeout'))` 与 `opts.onEnd?.()`，本次 `speak()` 流程终止。

重试期间 MUST NOT 触发 `onStart`；只有任一次 utterance 真实进入 `onstart` 时才调用一次 `onStart`。所有重试相关 setTimeout 必须以 `gen === this.generation` 守卫，外部 `stop()` 或新一轮 `speak()` 递增 `generation` 时全部静默作废。

#### Scenario: 一次失败一次成功
- **WHEN** 第 1 次 `speak()` 1500ms 内未触发 `onstart`
- **THEN** 引擎 cancel + resume，重建 utterance 在 `setTimeout(0)` 后重新 speak；若该次成功 → `onStart` 触发一次、用户听到声音；MUST NOT 触发 `onError`

#### Scenario: 全部重试失败给出终态错误
- **WHEN** 经过共 1 次原始 + 2 次重试（最长约 4500ms）仍未触发 `onstart`
- **THEN** 引擎调用 `onError(new Error('SpeechSynthesis start timeout'))` 与 `onEnd`，本次 `speak()` 终止；后续 `speak()` 不应受本次重试残留影响

#### Scenario: 重试期间被打断时残留计时器作废
- **WHEN** 引擎处于重试等待中，外部调用 `stop()`（或新一轮 `speak()`）使 `generation` 递增
- **THEN** 所有未触发的重试 `setTimeout` 因代际不匹配静默丢弃，MUST NOT 调用旧的 `onError` / `onEnd`，也 MUST NOT speak 出旧文本

### Requirement: speak() 支持 onStart 回调

`TtsSpeakOptions` SHALL 提供可选字段 `onStart?: () => void`。`BrowserSpeechSynthesisEngine` MUST 在 `utterance.onstart` 触发且当前播放代际未失效时调用 `onStart`，每次 `speak()` 至多触发一次（即使发生了重试，最终成功的那一次才回调）。`IflytekTtsEngine` MUST 在首帧音频实际入队播放时调用 `onStart`。

新增字段为 optional，未提供 `onStart` 的现有调用 MUST 保持现有行为不变。

#### Scenario: 浏览器引擎在真实发声时回调 onStart
- **WHEN** 调用方传入 `onStart` 调用 `BrowserSpeechSynthesisEngine.speak()`，且某一次（首次或重试后）正常发声
- **THEN** `onStart` 在对应 `utterance.onstart` 触发瞬间被调用且仅一次

#### Scenario: 启动重试全部失败时 onStart 不被调用
- **WHEN** `speak()` 全部重试失败，最终走 `onError + onEnd`
- **THEN** `onStart` MUST NOT 被调用


