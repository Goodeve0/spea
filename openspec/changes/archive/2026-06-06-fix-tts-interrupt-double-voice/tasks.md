## 1. 浏览器 TTS 引擎：代际与 stale 回调

- [x] 1.1 `web/src/audio/speech-synthesis.ts`：新增 `private generation`，`speak()` 开头 `++generation` 并捕获 `gen`，`stop()` 也 `++generation`
- [x] 1.2 `speech-synthesis.ts`：`utterance.onend` / `onerror` 内先校验 `gen === this.generation`，不匹配则静默返回；`interrupted` 错误不向上冒泡
- [x] 1.3 `speech-synthesis.ts`：`stop()` 时 `speechSynthesis.cancel()` 并清空 `this.utterance`
- [x] 1.4 `web/src/audio/speech-synthesis.test.ts`（新建）：测试 stop 后 stale onend 不调用 opts.onEnd；连续 speak 仅最后一次 onEnd 触发

## 2. 讯飞 TTS 引擎：代际、节点追踪与 stop 彻底化

- [x] 2.1 `web/src/audio/iflytek-tts-client.ts`：新增 `private generation`，`speak()` / `stop()` 均递增代际，所有异步出口校验代际
- [x] 2.2 `iflytek-tts-client.ts`：追踪已调度的 `AudioBufferSourceNode`，`stop()` 时对仍 connected 的节点调用 `stop()`
- [x] 2.3 `iflytek-tts-client.ts`：`stop()` 清除 `scheduleEnd` 定时器、`active`，`audioContext.close()` 并置 `null`（不再仅用 suspend）
- [x] 2.4 `iflytek-tts-client.ts`：`enqueuePcmFrame` 与 `handleMessage` 在代际或 `requestId` 不匹配时丢弃帧
- [x] 2.5 `web/src/audio/iflytek-tts-client.test.ts`（新建）：mock AudioContext；stop 后不再入队；代际变更后 onEnd 不触发

## 3. Conversation 层：先停后播与打断守卫

- [x] 3.1 `web/src/pages/Conversation.tsx`：将 `stopAudio` 重命名/提取为 `stopAllTts()`，依次 `getEngine('browser')?.stop()` 与 `getEngine('iflytek')?.stop()`
- [x] 3.2 `Conversation.tsx`：`stopSpeaking()` 改为 `stopAllTts()` + `setAiSpeaking(false)` + `setReadingTurnId(null)`，打断时递增 `interruptEpochRef`
- [x] 3.3 `Conversation.tsx`：`speakReply` 与 `handleReadAloud` 在 `engine.speak()` 前调用 `stopAllTts()`
- [x] 3.4 `Conversation.tsx`：`speakReply` 的 `onEnd` / 讯飞 `onError` 兜底回调内比对 `interruptEpochRef` 与闭包捕获的 epoch，已打断则不再 `browser.speak` 且不重置 UI 为旧消息朗读中
- [x] 3.5 `Conversation.tsx`：确认 `handleStartRecording` 与 `handleUserMessage` 均经 `stopSpeaking()` 打断，朗读按钮与 `readingTurnId` 同步复位

## 4. 验证

- [ ] 4.1 手动测试：AI 自动朗读中点麦克风说话 → 旧音频立即停止，新回复仅一声
- [ ] 4.2 手动测试：AI 自动朗读中发送文字打断 → 同上，无叠音
- [ ] 4.3 手动测试：讯飞引擎下连续打断 3 次 → 每次仅一个新声音
- [ ] 4.4 手动测试：跟读按钮播放中开始录音打断 → 按钮恢复空闲，新回复正常朗读
- [x] 4.5 `npm run lint -w web` 与 `npm test -w web` 通过
