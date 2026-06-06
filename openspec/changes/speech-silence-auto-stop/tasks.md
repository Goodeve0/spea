## 1. 基础模块

- [x] 1.1 `web/src/audio/voice-input-constants.ts`：定义 `SILENCE_DURATION_MS = 2000` 及 VAD 能量阈值常量
- [x] 1.2 `web/src/audio/silence-detector.ts`：从 `recorder.ts` 抽取 `SilenceDetector` 类，支持 `silenceDurationMs` 配置、`start(stream)` / `stop()`、回调 `onSpeech()` / `onSilence()`
- [x] 1.3 `web/src/audio/silence-detector.test.ts`：测试静音计时器在检测到说话后重置、达到阈值时触发 `onSilence`

## 2. recorder 重构

- [x] 2.1 `web/src/audio/recorder.ts`：删除内联 VAD 逻辑，改为复用 `SilenceDetector`，保持 `onVadSilence` 对外接口不变

## 3. 对话页录音流程改造

- [x] 3.1 `web/src/pages/Conversation.tsx`：`handleStartRecording` 中并行启动 `BrowserSpeechRecognition` 与 `SilenceDetector`（通过 `getUserMedia` 获取 stream）
- [x] 3.2 `Conversation.tsx`：引入 `pendingTranscript` ref，收到 `isFinal` 时追加文本（空格拼接）而非立即提交
- [x] 3.3 `Conversation.tsx`：实现 `finishRecording()` 统一结束路径——停止 recognition + silenceDetector，有文本则 `handleUserMessage`，无文本则静默结束
- [x] 3.4 `Conversation.tsx`：`handleStopRecording` 改为调用 `finishRecording({ reason: 'manual' })`
- [x] 3.5 `Conversation.tsx`：`SilenceDetector.onSilence` 回调中，仅当 `hasSpoken === true` 且 `pendingTranscript`/interim 合并文本非空时自动提交
- [x] 3.6 `Conversation.tsx`：维护 `hasSpoken` 状态（VAD 检测到说话或识别文本非空时置 true）
- [x] 3.7 `Conversation.tsx`：收到 `isFinal` 或 interim 文本变化时重置 SilenceDetector 静音计时
- [x] 3.8 `Conversation.tsx`：`onError` 中对 `no-speech` 静默处理；若有 `pendingTranscript` 则调用 `finishRecording` 提交

## 4. 验证

- [x] 4.1 手动测试：说完话停顿 2 秒后自动提交，句间 0.5 秒停顿不结束
- [x] 4.2 手动测试：手动点击麦克风停止并提交；未说话时不触发 LLM
- [x] 4.3 手动测试：多句连续说，`isFinal` 聚合为一条消息提交
- [x] 4.4 `npm run lint -w web` 与 `npm test -w web` 通过
