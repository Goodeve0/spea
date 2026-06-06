## Why

进入对话页时，应用会立即自动调用 TTS 朗读 AI 开场白，UI 同步显示"正在朗读…"。但实际表现是**间歇性失败 —— 时有时没**：有时能听到开场白，有时只显示文字与"正在朗读…"却完全没声音，且不会自动复位回正常态。

经定位，根因不是浏览器 Autoplay Policy 完全锁死（那样会 100% 无声），而是 `speechSynthesis` 在以下边界条件下**静默吞掉** utterance：`speechSynthesis.paused` 残留态、`cancel()` 后立即 `speak()` 的浏览器 quirk、`voiceschanged` 异步、跨路由/刷新带来的手势上下文丢失。这些场景下，浏览器既不发声、也不触发 `onstart/onend/onerror`，UI 卡在"正在朗读"。

## What Changes

- **保留 mount 时自动朗读开场白的现有 UX**（不引入显式播放按钮，不取消自动朗读，其他逻辑全部不变）。
- **核心修复**：`BrowserSpeechSynthesisEngine.speak()` 内部增加"清理 + 重试 + 超时"三段式可靠性机制：
  - 进入前 `resume()` + `cancel()` 清残留态、清 utterance 队列；
  - `setTimeout(0)` 延迟一帧再 `speak()`，规避"cancel→speak" Chrome quirk；
  - 启动超时（1500ms）未触发 `onstart` → 自动重试最多 2 次（重建 utterance）；
  - 全部重试失败 → 触发 `onError + onEnd`，让上层 UI 复位。
- 沿用已扩展的 `TtsSpeakOptions.onStart` 与启动计时器机制；上层 `setReadingTurnId` 时序**不变**（仍在调用 speak 前就点亮 UI），靠 `onError` 兜底闭环。
- 讯飞引擎已加 3000ms 启动超时兜底（首帧未到 → onError → 切回浏览器引擎）；浏览器引擎新增重试机制天然吸收这一波。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `tts-engine`：浏览器引擎 `speak()` 增加启动超时兜底与有限自动重试；新增 `TtsSpeakOptions.onStart` 字段；明确 `BROWSER_START_TIMEOUT_MS=1500` / `IFLYTEK_START_TIMEOUT_MS=3000` 与最多 2 次重试预算。
- `read-aloud`：保持现有"进入对话页自动朗读开场白"的行为不变，但新增"启动失败时 UI 必须自动复位"的可靠性约束。

## Impact

- **代码**
  - `web/src/audio/tts-engine.ts`：已新增 `onStart` 字段与 `BROWSER_START_TIMEOUT_MS` / `IFLYTEK_START_TIMEOUT_MS` 常量。
  - `web/src/audio/speech-synthesis.ts`：将原来的"一次 speak + 启动超时直接失败"改为"清理 + setTimeout(0) 入队 + 启动超时 + 最多 2 次重试 + 终态失败回调"。
  - `web/src/audio/iflytek-tts-client.ts`：已加 3000ms 启动超时与首帧 `onStart` 触发，无需再改。
  - `web/src/pages/Conversation.tsx`：**不改 mount 时的 speakReply 调用**，仅确认 `speakReply.onError` 在新引入的"启动超时"路径下也能正确复位 UI。
- **行为**
  - 用户感知：进入页面一般场景仍立刻听到开场白；偶发挂起态由引擎内部 1~2 次重试自动恢复；最坏情况下 4.5s 内 UI 复位，不再卡死。
  - 不影响后续多轮自动朗读流程（同一 speak 路径，重试机制天然受益）。
- **依赖/API**：仅前端，无后端协议改动，无新依赖。
- **风险**：极端环境下重试全部失败时，用户会看到最多 4.5s 的"正在朗读…"假状态后复位；本期通过日志观察 `[BrowserSpeechSynthesisEngine.speak] start retry`/`start timeout` 出现频次决定是否进一步加 toast 提示。
