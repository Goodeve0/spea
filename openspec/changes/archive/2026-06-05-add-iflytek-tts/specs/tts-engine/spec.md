## ADDED Requirements

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
