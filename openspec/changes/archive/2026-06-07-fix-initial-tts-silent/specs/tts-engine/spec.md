## ADDED Requirements

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
