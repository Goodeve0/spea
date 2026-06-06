## Why

当前用户在口语练习中，AI 回复会自动朗读，但用户自己的发言和已过期的 AI 回复无法再次播放。用户需要回听任意消息来纠正发音、模仿语调，或加深对句子的记忆，因此需要在每条消息下方添加一个独立的朗读按钮。

## What Changes

- **新能力**：前端新增 `read-aloud` 组件与交互逻辑
- **前端修改**：在 `Conversation.tsx` 的每条消息气泡下方添加一个朗读按钮（喇叭图标），点击后使用当前 TTS 引擎朗读该消息的文本
- **后端修改**：无新增后端接口——朗读功能复用现有的 `tts.request` / `tts.audio` / `tts.done` WebSocket 消息流
- **音频状态**：朗读期间显示播放状态动画，可打断（再次点击停止），同一时刻最多朗读一条消息

## Capabilities

### New Capabilities
- `read-aloud`: 在对话 AI 消息上提供按需朗读按钮，使用当前 TTS 引擎播放单条消息的文字内容，支持播放/停止切换

### Modified Capabilities
<!-- 无现有 spec 级别行为变更 -->

## Impact

- **Web 前端** (`web/src/pages/Conversation.tsx`): 在每条 turn 消息的渲染区域添加朗读按钮，可能需要抽取独立的 `TurnBubble` 组件以保持代码清晰
- **Web 音频层** (`web/src/audio/`): 可能需要在 TTS 引擎上暴露一个独立的 `speakOnce(text)` 方法，或直接复用现有的 `engine.speak()`
- **状态管理** (`web/src/store/`): 可能需要新增一个 `readingTurnId` 状态来管理当前正在朗读的消息 ID
- **共享契约** (`shared/contracts.ts`): 无变更
- **后端**: 无变更