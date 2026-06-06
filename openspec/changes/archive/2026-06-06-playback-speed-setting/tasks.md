## 1. 状态管理与持久化

- [x] 1.1 `web/src/store/settings.ts`：新增 `playbackSpeed: number` 字段（默认 `1`）
- [x] 1.2 `web/src/store/settings.ts`：新增 `setPlaybackSpeed(speed: number): void` setter，更新 store 并持久化到 `localStorage`
- [x] 1.3 `web/src/store/settings.ts`：更新 `PersistedSettings` 接口和 `persistToStorage` / `loadFromStorage` 逻辑，包含 `playbackSpeed`
- [x] 1.4 `web/src/store/settings.ts`：加载时校验 `playbackSpeed` 合法性，非法值回退到 `1`

## 2. TTS 引擎接口与实现

- [x] 2.1 `web/src/audio/tts-engine.ts`：`TtsSpeakOptions` 新增可选字段 `rate?: number`
- [x] 2.2 `web/src/audio/speech-synthesis.ts`：`speak()` 中应用 `options?.rate ?? settings.playbackSpeed` 到 `utterance.rate`
- [x] 2.3 `web/src/audio/iflytek-tts-client.ts`：`enqueuePcmFrame()` 中创建 `source` 后设置 `source.playbackRate.value = options?.rate ?? settings.playbackSpeed`
- [x] 2.4 `web/src/audio/iflytek-tts-client.ts`：确保 `playbackRate` 在 `AudioBufferSourceNode.start()` 之前设置

## 3. 设置面板 UI

- [x] 3.1 `web/src/components/SettingsPanel.tsx`：引入 `playbackSpeed` 和 `setPlaybackSpeed` 从 settings store
- [x] 3.2 `web/src/components/SettingsPanel.tsx`：在「语音合成引擎」区域下方新增「播放速度」section，渲染 5 个 radio 按钮（0.5x / 0.75x / 1x / 1.25x / 1.5x）
- [x] 3.3 `web/src/components/SettingsPanel.tsx`：radio 按钮绑定 `playbackSpeed`，变更时调用 `setPlaybackSpeed`
- [x] 3.4 `web/src/components/SettingsPanel.tsx`：速度选择器在两种引擎下均可见，不随引擎切换而隐藏

## 4. 验证

- [x] 4.1 打开设置面板，确认 5 档速度选项可见，默认选中 1x
- [x] 4.2 切换速度为 0.5x，触发 AI 朗读，确认浏览器 TTS 语速变慢
- [x] 4.3 切换速度为 1.25x，触发 AI 朗读，确认讯飞 TTS 语速变快
- [x] 4.4 刷新页面，确认速度设置保持
- [x] 4.5 切换 TTS 引擎，确认速度设置保持
- [x] 4.6 ESLint + TypeScript 编译通过，无新增 `any` 或类型错误
