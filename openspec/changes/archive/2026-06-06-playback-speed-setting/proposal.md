## Why

用户在英语口语练习中，常需要以不同速度回听 AI 的发音，以便仔细辨音模仿（慢速）或以正常语速练习。当前 TTS 播放固定为 1 倍速，缺少速度调节功能。

## What Changes

- 在设置面板（SettingsPanel）中新增「播放速度」选项组，提供 0.5x、0.75x、1x、1.25x、1.5x 共 5 档速度
- 默认值：1x（正常速度）
- 设置项持久化到 localStorage，跨会话保持
- 浏览器内置 TTS 引擎（SpeechSynthesis）通过 `utterance.rate` 控制速度
- 讯飞 TTS 引擎（IflykTS）通过 `AudiBuferSourceNode.playbackRate` 控制速度
- 速度设置在切换 TTS 引擎时保持生效

## Capabilities

### New Capabilities
- `playback-speed`: 提供TTS 音频播放速度的全局设置与控制，包括前端速度状态管理、UI选择器、以及两个 TTS 引擎各自的速度适配实现

### Modified Capabilities


## Impact

- `web/src/store/settings.ts` — 新增 `playbackSpeed` 状态字段及 setter，更新持久化逻辑
- `web/src/components/SettingsPanel.tsx` — 新增「播放速度」选项组 UI
- `web/src/audio/tts-engine.ts` — `TtsSpeakOptions` 新增 `rate` 字段，`ITtsEngine` 接口不变
- `web/src/audio/speech-synthesis.ts` — 在 `speak()` 中应用 `opts.rate` 到 `utterance.rate`
- `web/src/audio/iflytek-tts-client.ts` — 在 `enqueuePcFrame()` / `createBufferSource()` 后设置 `source.playbackRate.value`