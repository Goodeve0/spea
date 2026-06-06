## 1. Store 层：新增 readingTurnId 状态

- [ ] 1.1 在 `web/src/store/session.ts` 的 `SessionState` 中新增 `readingTurnId: string | null` 字段
- [ ] 1.2 新增 `setReadingTurnId(id: string | null)` action
- [ ] 1.3 在 `reset()` 中重置 `readingTurnId` 为 null

## 2. 工具函数：提取 stopAudio

- [ ] 2.1 在 Conversation.tsx 中将原有的 `stopSpeaking` 拆为 `stopAudio()`（仅停止引擎，不设 isAiSpeaking）和保留 `stopSpeaking` 调用 `stopAudio + setAiSpeaking(false)`
- [ ] 2.2 验证现有用户说话打断 AI、结束会话等场景的 stopSpeaking 行为不变

## 3. 朗读按钮 UI

- [ ] 3.1 在每条消息气泡下方添加朗读按钮（🔊 图标），`text-xs`、`text-gray-400 hover:text-indigo-500` 风格
- [ ] 3.2 实现播放/停止切换逻辑：`readingTurnId === turn.id` 时显示声波动画（🔊→🔊🔊），点击调用 `stopAudio()` 并 `setReadingTurnId(null)`
- [ ] 3.3 实现自动朗读时的禁用逻辑：`isAiSpeaking` 为 true 时朗读按钮 `disabled`
- [ ] 3.4 消费 `readingTurnId` 控制按钮动画：仅 `readingTurnId === turn.id` 的消息展示播放状态

## 4. 朗读交互逻辑

- [ ] 4.1 点击朗读按钮时：若已有朗读中的消息，先停止 → 获取当前 TTS 引擎 → 调用 `engine.speak(turn.text, { onEnd, onError })` → 设 `setReadingTurnId(turn.id)`
- [ ] 4.2 `onEnd` 回调中 `setReadingTurnId(null)`，`onError` 回调用 `console.error` 记录并 `setReadingTurnId(null)`
- [ ] 4.3 AI 自动朗读开始时如果 `readingTurnId` 非空，先 `stopAudio()` 并 `setReadingTurnId(null)`

## 5. 验证

- [ ] 5.1 用户消息可以点击朗读
- [ ] 5.2 AI 消息可以点击朗读
- [ ] 5.3 朗读中点击同一按钮 → 停止
- [ ] 5.4 朗读消息 A 时点击消息 B → 停止 A，开始朗读 B
- [ ] 5.5 AI 自动朗读时朗读按钮 disabled
- [ ] 5.6 讯飞引擎下朗读正常（复用现有引擎 speak）