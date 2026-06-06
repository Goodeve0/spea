## 1. TTS 引擎契约（已完成）

- [x] 1.1 在 `web/src/audio/tts-engine.ts` 的 `TtsSpeakOptions` 中新增可选字段 `onStart?: () => void`，更新接口注释说明其语义（"音频真实开始播放时触发，仅一次"）。
- [x] 1.2 在同文件顶部抽出常量 `BROWSER_START_TIMEOUT_MS = 1500` 与 `IFLYTEK_START_TIMEOUT_MS = 3000`（导出供两个引擎复用），加注释解释阈值依据（参考 design.md D2）。

## 2. 浏览器引擎：启动超时 + 自动重试 + 清理 quirk

- [x] 2.1 修改 `web/src/audio/speech-synthesis.ts`：在 `BrowserSpeechSynthesisEngine` 中新增 `private startTimer: ReturnType<typeof setTimeout> | null = null` 字段。
- [x] 2.2 实现启动超时基本兜底（首版：直接 cancel + onError + onEnd）。
- [x] 2.3 在 `utterance.onstart` 中清掉 `startTimer`，并新增对 `opts?.onStart?.()` 的调用（受 `gen === this.generation` 守卫）。
- [x] 2.4 在 `stop()` 与 `dispose()` 中清掉 `startTimer`。
- [x] 2.5 单测：补充正常 `onStart` 触发顺序与启动超时兜底两个用例。
- [x] 2.6 把"启动超时直接失败"改造为"清理 + 重试 + 终态失败"流程：
  - 抽常量 `MAX_START_RETRIES = 2`（文件内本地 const）。
  - 重构 `speak()`：把 utterance 创建 + 注册回调 + `speechSynthesis.speak()` + 启动计时器封装为一个内部 `tryStart(retryCount: number)` 函数；`speak()` 的入口流程为：`stop()` → `++generation` → `try { speechSynthesis.resume() } catch` → `speechSynthesis.cancel()` → `setTimeout(() => tryStart(0), 0)`。
  - 启动超时回调改为：若 `retryCount < MAX_START_RETRIES` → `++generation` 作废本次 utterance、`cancel()` + try `resume()`、`console.warn('[BrowserSpeechSynthesisEngine.speak] start retry, attempt:', retryCount + 1)`、`setTimeout(() => tryStart(retryCount + 1), 0)`；若已达上限 → 走原有 `onError + onEnd` 终态。
  - 重建 utterance 时同样从 opts 还原 text/voice/rate/pitch；不可复用旧 utterance 实例。
- [x] 2.7 补充重试相关单测：
  - (c) 第 1 次 1500ms 不触发 onstart，引擎自动重试，第 2 次 onstart 触发 → `onStart` 被调用 1 次、`onError` 未被调用、`cancel()` 被调用至少 2 次（一次重试前 + 一次进入前）。
  - (d) 连续 3 次都不触发 onstart（即超过 `MAX_START_RETRIES`） → 最终触发 1 次 `onError('SpeechSynthesis start timeout')` 与 1 次 `onEnd`，`onStart` 未被调用。
  - (e) 重试等待中调用 `engine.stop()` → 后续无任何 onError/onEnd/onStart 触发。

## 3. 讯飞引擎：占位 onStart + 启动超时（已完成）

- [x] 3.1 定位 `web/src/audio/iflytek-tts-client.ts` 现有 speak 流程与 `onError` 触发点。
- [x] 3.2 实现首帧音频实际入队播放时调用 `opts?.onStart?.()`。
- [x] 3.3 增加 `IFLYTEK_START_TIMEOUT_MS` 计时器：从 `speak()` 调用起到首帧入队为止；超时则关闭/作废本次 WS 会话，调用 `opts?.onError?.(new Error('Iflytek TTS start timeout'))` + `opts?.onEnd?.()`，并 `console.error` 关键参数。
- [x] 3.4 收到首帧时清掉计时器；`stop()` / `dispose()` 中也要清。
- [x] 3.5 与既有"WS 错误 → onError 兜底回浏览器引擎"路径协作，未触发双 onError。

## 4. 对话页：保持 mount 自动朗读，仅确认 onError 闭环

- [x] 4.1 **不修改** `Conversation.tsx` 初始化 `useEffect` 中 `speakReply(greetingId, greeting, ...)` 的调用与时序（保留现有 UX）。
- [x] 4.2 **不修改** `speakReply` 的 `setReadingTurnId(turnId)` 时序（仍在 `engine.speak()` 之前调用）。
- [x] 4.3 **不修改** `handleReadAloud` 时序。
- [x] 4.4 通读 `Conversation.tsx` 中 `speakReply` 与 `handleReadAloud` 的 `onError` 路径，确认"启动超时"导致的 onError 触发后能：清掉 `readingTurnId`、释放 `readingBusyRef`、`setAiSpeaking(false)`。如有遗漏分支补齐。
  - 审查结论：`speakReply.onError` 在非讯飞分支只 `setReadingTurnId(null)`，但引擎在 onError 之后还会再调用一次 onEnd（speech-synthesis.ts 终态分支），onEnd 处理中调用外部传入的 `onEnd=() => setAiSpeaking(false)`，UI 完整复位。`handleReadAloud.onError` 已复位 `readingTurnId` 与 `readingBusyRef`，且该路径不持有 `isAiSpeaking`。闭环成立，无需修改。

## 5. （取消）开场白播放入口高亮

> 本组任务已取消：保留现有自动朗读 UX，不引入显式播放按钮，因此原 5.1-5.3 不再执行。

- [x] 5.1 ~~识别"开场白消息"~~（取消）
- [x] 5.2 ~~渲染高亮态视觉~~（取消）
- [x] 5.3 ~~不修改 handleReadAloud 行为~~（取消）

## 6. 验证与回归

- [x] 6.1 运行 `npm test -w web -- run src/audio/speech-synthesis.test.ts` 确保所有用例（含新增重试用例）通过。
- [x] 6.2 运行 `npm test -w web -- run src/audio/iflytek-tts-client.test.ts` 确保讯飞引擎无回归。
- [ ] 6.3 本地 `npm run dev:web` 手工验证：进入对话页 → 大概率立即听到开场白 + 显示"🔊 正在朗读…"，多次刷新观察是否仍出现"显示朗读但无声"的卡死。
- [ ] 6.4 手工模拟"启动超时"：DevTools 控制台执行 `Object.defineProperty(SpeechSynthesisUtterance.prototype, 'onstart', { set() {} })` 让 onstart 永不调用，进入页面 → 应在约 4.5s 后看到按钮回空闲态并出现 `[BrowserSpeechSynthesisEngine.speak] start timeout` 日志。
- [ ] 6.5 手工回归 specs/read-aloud 既有需求：录音/文字打断自动朗读 → TTS 立即停；连续 speak 仅最后一句可听；讯飞失败 → 浏览器引擎兜底正常。
- [ ] 6.6 ESLint + Prettier 通过（项目 PostToolUse hook 已自动跑，确认无残留警告）。

## 7. OpenSpec 校验与归档准备

- [x] 7.1 运行 `openspec validate fix-initial-tts-silent` 确保所有工件通过。
- [ ] 7.2 PR 描述链接 `openspec/changes/fix-initial-tts-silent/`，列明涉及的两个 capability delta（`read-aloud`、`tts-engine`）。
- [ ] 7.3 合并后运行 `/opsx:archive fix-initial-tts-silent` 把 delta 合并回 `openspec/specs/`。
