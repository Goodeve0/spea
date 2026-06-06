## Context

**当前状态**
- `web/src/pages/Conversation.tsx` 的 AI 回复生成后自动通过 `speakReply` 调用当前 TTS 引擎朗读，但用户无法重新播放已朗读的消息。
- 项目已有完善的 TTS 引擎体系（`web/src/audio/tts-engine.ts`），提供统一的 `ITtsEngine.speak(text, options?)` 接口，支持浏览器 SpeechSynthesis 和讯飞在线 TTS。
- 朗读功能只需在前端复用该体系，无需后端改动。

**约束**
- 不能破坏 AI 回复自动朗读的现有流程。
- 不能为单条回放引入新 WebSocket 消息类型或后端接口。

## Goals / Non-Goals

**Goals**
1. 每条 AI 消息气泡下方显示一个朗读按钮，点击后使用当前 TTS 引擎朗读该条消息。
2. AI 自动朗读时对应消息的按钮同步亮起激活态；朗读结束或被打断时恢复空闲态。
3. 同一时刻最多朗读一条消息；点击其他条时先停止当前再开始新的。
4. LLM 生成 token 期间按钮置灰，朗读中可随时切换。

**Non-Goals**
- 不新增后端接口或 WebSocket 消息类型。
- 不修改 AI 回复的自动朗读逻辑本身。
- 不做服务端朗读缓存或文本高亮跟随进度滚动。
- 用户消息不显示朗读按钮。

## Decisions

### 决策 1：`readingTurnId` 放入 session store

在 `web/src/store/session.ts` 的 `SessionState` 中新增 `readingTurnId: string | null`，记录当前正在被朗读的消息 ID。
**选择**：session store 扩展字段。
**为什么**：朗读状态需要跨多条消息渲染共享，放父组件 `useState` 会增大 Conversation 组件状态复杂度；单独建 store 则朗读状态本质上隶属会话，无必要拆分。
**替代方案**：独立 `useState` 或新建 `useReadingStore` —— 均被否决，理由见上。

### 决策 2：复用 `ITtsEngine.speak()` 而不新增方法

朗读调用直接走 `getEngine(engineId).speak(text, { onEnd, onError })`，不在引擎接口上新增 `speakOnce`。
**为什么**：`speak` 已支持 `onEnd` 回调，引擎内部处理了 WebSocket/API 连接生命周期，复用可零新增代码。

### 决策 3：`speakReply` 接收 `turnId` 参数同步按钮状态

扩展 `speakReply(turnId, text, onEnd?)` 签名，调用前 `setReadingTurnId(turnId)`，`onEnd/onError` 中 `setReadingTurnId(null)`。
**为什么**：AI 自动朗读与手动朗读共享同一套状态，无需额外逻辑即可同步按钮激活态；分两套状态反而需要协调。
**替代方案**：AI 自动朗读保持原状、手动朗读单独管理状态 —— 会导致 AI 朗读期间按钮不亮，需求不满足。

### 决策 4：提取 `stopAudio()` 与 `stopSpeaking()` 分层

将原有 `stopSpeaking()` 拆为两层：`stopAudio()`（仅停止引擎，不改状态）和 `stopSpeaking()`（`stopAudio` + `setAiSpeaking(false)` + `setReadingTurnId(null)`）。
**为什么**：手动点击"切换到另一条"时只需停止引擎、设 `readingTurnId`，不应重置 `isAiSpeaking`；用户录音打断 AI 时才需要同时清 `isAiSpeaking`。分层使调用意图明确。

### 决策 5：按钮 disabled 条件改为 `isLoading` 而非 `isAiSpeaking`

LLM 生成 token 时（`isLoading = true`）禁用朗读按钮；TTS 朗读中按钮保持可点击，支持随时切换。
**为什么**：`isAiSpeaking` 与 `readingTurnId` 现在已同步，按钮高亮本身就是"正在朗读"的反馈；禁用会阻止用户切换其他条消息。`isLoading` 期间 AI 回复尚未入库，无有效消息可朗读，禁用合理。

## Risks / Trade-offs

- **[竞态] 朗读期间 AI 新回复生成 → `speakReply` 覆盖 `readingTurnId`**：新 AI 回复会直接设置新 `readingTurnId`，视觉上切换到新消息的按钮激活，旧消息按钮自动复位。行为符合预期。
- **[操作锁] `readingBusyRef` 防重复点击**：`speak()` 是异步的，快速双击可能触发两次 `engine.speak()`。用 `readingBusyRef` 在 `onEnd/onError` 中释放，确保同一时刻只有一次朗读调用。需要注意 `onEnd` 必须一定被调用，否则锁死。
- **[讯飞兜底] 讯飞 `onError` 后切换到浏览器引擎**：`speakReply` 的错误回调会重新设置 `readingTurnId(turnId)` 再用浏览器引擎朗读，确保状态不遗漏。

## Migration Plan

1. `session.ts` 新增 `readingTurnId` 字段与 `setReadingTurnId` action（无破坏性）。
2. `Conversation.tsx` 提取 `stopAudio()`，扩展 `speakReply` 签名，新增 `handleReadAloud`（带操作锁）。
3. 消息渲染区为每条 AI 消息气泡下方插入朗读按钮 JSX。
4. 所有已有 `speakReply(text, ...)` 调用处补传 `turnId`。

**回滚**：以上改动全部在前端，不涉及后端；若需回滚，还原 `session.ts` 和 `Conversation.tsx` 即可。

## Open Questions

1. **是否要在报告页对纠错示例也加朗读？** —— 本变更不做，后续有需求再扩展。
2. **多条消息快速切换时的音频 overlap 问题在讯飞引擎上是否完全消除？** —— 依赖讯飞引擎 `stop()` 实现；若存在问题需在 `IflytekTtsEngine.stop()` 内补 WS 取消逻辑。
