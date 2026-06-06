## Context

当前 TTS 播放始终固定为 1 倍速。用户（尤其是英语学习者）常需要慢速回听以模仿发音细节，或加速练习以提升听力适应度。

现有设置系统已具备完整的持久化链路：`settings` store (zustand) → `localStorage['speak-coach.settings']` → 页面加载时恢复。SettingsPanel 为 Modal 弹窗，已承载引擎选择与音色选择两组配置。双 TTS 引擎均已通过 `ITtsEngine` 接口统一管理。

## Goals / Non-Goals

**Goals:**
- 用户可在设置面板选择 5 档播放速度，默认 1x
- 速度设置即时生效，无需刷新页面
- 速度设置跨会话保持
- 浏览器 TTS 与讯飞 TTS 均支持速度控制

**Non-Goals:**
- 服务端 TTS 参数调整（后端讯飞 `tts.request` 的 WebSocket 报文格式保持不变）
- 逐字/逐句变速或自定义变速曲线
- 低于 0.5x 或高于 1.5x 的极端速度
- 播放中实时变速（当前播放句仍以旧速度播完，下一句生效）

## Decisions

### 1. 全局状态 vs 引擎局部状态

**决策：** 将 `playbackSpeed` 放在 `settings` store 中作为全局状态，不放在单个引擎内部。

**理由：**
- 速度是用户偏好，与 TTS 引擎正交，切换引擎后应保持同一速度
- 已存在成熟的 `settings` store + localStorage 持久化链路，复用成本低
- 引擎本身已是无状态/轻状态设计，不引入额外耦合

**替代方案：** 在每个引擎内部各自维护 `defaultRate` — 被否决，会导致切换引擎时速度重置，且持久化逻辑重复。

### 2. 速度参数传递方式：`TtsSpeakOptions.rate` vs 引擎运行时读取 store

**决策：** 两种机制并存 — `TtsSpeakOptions` 新增 `rate` 字段作为显式参数；若调用方未传入，引擎内部回退读取 `settings` store。

**理由：**
- `TtsSpeakOptions` 是现有 `speak()` 的扩展点，向后兼容
- 显式参数便于未来特殊场景（如逐句变速练习）覆盖全局设置
- 大多数调用方无需修改，引擎内部兜底读取保证当前行为不变

### 3. 讯飞引擎变速实现：`playbackRate` vs 服务端变速

**决策：** 在前端 Web Audio API 的 `AudioBufferSourceNode.playbackRate` 上实现，不修改后端 TTS 合成参数。

**理由：**
- 服务端讯飞 TTS 参数中虽有语速控制，但不同音色支持的语速范围不一致，且前端无法感知服务端限速
- Web Audio API 的 `playbackRate` 是标准、可靠、跨平台的前端变速方案
- 后端的 PCM 帧传输链路无需任何改动

**风险：** `playbackRate` 会同时改变音高（升速变尖、降速变沉）。对于 0.75x–1.5x 的范围，音高偏移在可接受范围内，且口语练习场景下用户更关注语速而非绝对音高。

### 4. UI 布局：radio 按钮组 vs slider

**决策：** 使用 5 个 radio 按钮组，不使用 slider。

**理由：**
- 离散档位避免浮点精度问题（`localStorage` 存储 `1` 而非 `1.0000001`）
- 选项数量少（5 个），radio 比 slider 更直观、误触率更低
- 与现有设置面板风格一致（引擎选择也使用 radio）

## Risks / Trade-offs

- **[Risk]** 讯飞 `playbackRate` 变速会改变音高 → **缓解**：变速范围限制在 0.5x–1.5x，音高偏移可控；未来如需保真变速可引入 `playbackRate` + `detune` 组合或切换后端变速
- **[Risk]** `SpeechSynthesisUtterance.rate` 在不同浏览器中实际效果差异较大（Chrome 的 `rate=2` 可能极快）→ **缓解**：将选项上限限制为 1.5x，确保各浏览器体验相对一致
- **[Risk]** 播放中切换速度，当前句仍以旧速度播完，用户可能误以为未生效 → **缓解**：UI 无需额外提示，下一句 AI 回复即体现新速度，符合用户预期

## Migration Plan

无需迁移。纯前端增量功能，不修改后端、不修改数据库、不修改 API。现有用户的 `localStorage` 中无 `playbackSpeed` 字段，首次读取时 store 的默认值 `1` 自动生效。

## Open Questions

无。