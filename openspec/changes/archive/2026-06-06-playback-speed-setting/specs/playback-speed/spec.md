# playback-speed Specification

## Purpose
定义 TTS 音频播放速度的全局设置、持久化、UI 交互及双引擎适配行为。

## ADDED Requirements

### Requirement: 全局播放速度状态

前端 SHALL 在 `settings` store 中维护一个 `playbackSpeed` 字段，类型为 `number`，允许取值为 `0.5`、`0.75`、`1`、`1.25`、`1.5`。默认值 MUST 为 `1`。该字段变更后 MUST 立即持久化到 `localStorage['speak-coach.settings']` 中。

#### Scenario: 首次访问
- **WHEN** 用户首次打开应用（`localStorage` 无 `speak-coach.settings`）
- **THEN** `settings.playbackSpeed` 为 `1`

#### Scenario: 切换速度并持久化
- **WHEN** 用户在设置面板将速度从 `1` 改为 `0.75`
- **THEN** `settings.playbackSpeed` 立即变为 `0.75`，`localStorage['speak-coach.settings'].playbackSpeed === 0.75`

#### Scenario: 刷新后恢复
- **WHEN** 用户选择 `1.25x` 后关闭浏览器再打开
- **THEN** `settings.playbackSpeed` 仍为 `1.25`

### Requirement: 设置面板速度选择器

设置面板 SHALL 在「语音合成引擎」区域下方渲染一个「播放速度」选项组，提供 5 个 radio 按钮，分别标注 `0.5x`、`0.75x`、`1x`、`1.25x`、`1.5x`。当前选中项 MUST 来自 `settings.playbackSpeed`。该选项组 MUST 独立于 TTS 引擎选择器，在两种引擎下均可见且可操作。

#### Scenario: 打开设置面板可见速度选项
- **WHEN** 用户点击齿轮图标打开设置面板
- **THEN** 面板中「播放速度」区域渲染 5 个 radio 按钮，默认 `1x` 为选中态

#### Scenario: 切换引擎保持速度
- **WHEN** 用户当前速度为 `1.25x`，切换 TTS 引擎从浏览器到讯飞
- **THEN** 速度选择器仍显示 `1.25x` 为选中态

### Requirement: 浏览器 TTS 引擎速度控制

`BrowserSpeechSynthesisEngine.speak()` 在构造 `SpeechSynthesisUtterance` 时，MUST 将 `utterance.rate` 设置为当前 `settings.playbackSpeed` 的值。若 `playbackSpeed` 未设置或非法，MUST 回退到 `1`。

#### Scenario: 浏览器引擎以 0.5x 播放
- **WHEN** `settings.playbackSpeed === 0.5` 且调用浏览器引擎 `speak('Hello')`
- **THEN** 生成的 `SpeechSynthesisUtterance` 的 `rate` 属性为 `0.5`

#### Scenario: 浏览器引擎播放中切速
- **WHEN** 浏览器正在朗读时用户在设置面板将速度改为 `1.5x`
- **THEN** 当前句子继续以旧速度播完，下一句 AI 回复使用 `1.5x` 速度

### Requirement: 讯飞 TTS 引擎速度控制

`IflytekTtsEngine` 在 `enqueuePcmFrame()` 中创建 `AudioBufferSourceNode` 后，MUST 将 `source.playbackRate.value` 设置为当前 `settings.playbackSpeed` 的值。若 `playbackSpeed` 未设置或非法，MUST 回退到 `1`。

#### Scenario: 讯飞引擎以 1.25x 播放
- **WHEN** `settings.playbackSpeed === 1.25` 且调用讯飞引擎 `speak('Hello')`
- **THEN** 每个 `AudioBufferSourceNode` 的 `playbackRate.value` 为 `1.25`

#### Scenario: 讯飞引擎播放中切速
- **WHEN** 讯飞引擎正在朗读时用户在设置面板将速度改为 `0.75x`
- **THEN** 已缓冲的音频帧继续以旧速度播完，下一批音频帧使用 `0.75x` 速度

### Requirement: TTS 引擎接口传递速度

`TtsSpeakOptions` 接口 SHALL 新增可选字段 `rate?: number`。引擎实现 `speak()` 时 SHOULD 优先读取 `options.rate`；若 `options` 中未提供 `rate`，则从 `settings` store 读取当前 `playbackSpeed`。

#### Scenario: 显式传入速度覆盖全局
- **WHEN** `settings.playbackSpeed === 1` 且调用 `speak('Hello', { rate: 0.5 })`
- **THEN** 引擎使用 `0.5` 播放，不采用全局设置 `1`

#### Scenario: 未传入速度时使用全局
- **WHEN** `settings.playbackSpeed === 1.5` 且调用 `speak('Hello')`
- **THEN** 引擎使用 `1.5` 播放
