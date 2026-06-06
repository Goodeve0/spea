## 1. 前端：PCM 采集层（AudioWorklet + 降采样）

- [ ] 1.1 新增 `web/public/pcm-worklet.js`：AudioWorklet processor，每次 `process()` 把输入 Float32 帧拷贝并 `port.postMessage` 回主线程；无输入时静默。
- [ ] 1.2 新增 `web/src/audio/pcm-recorder.ts`：
  - `start(stream)`：建 `AudioContext`、`addModule('/pcm-worklet.js')`、接 `MediaStreamAudioSourceNode → AudioWorkletNode`，累积 Float32 帧。
  - 记录原生 `sampleRate`（用于降采样比例）。
  - `stop(): Int16Array`：合并所有帧 → 抗混叠低通（滑动平均，截止 ~7.2kHz）→ 按比例降采样到 16kHz → Float32 转 Int16 PCM 返回。
  - `dispose()`：关闭 AudioContext、断开节点。
  - `isSupported()`：检测 `window.AudioWorklet` 是否可用。
- [ ] 1.3 单测 `web/src/audio/pcm-recorder.test.ts`：降采样比例正确（48k→16k 长度约 1/3）、Int16 范围 clamp 到 [-32768, 32767]、空输入返回空数组、低通对纯高频信号有衰减。

## 2. 前端：useVoiceInput 并行录 PCM

- [ ] 2.1 修改 `web/src/hooks/useVoiceInput.ts`：在 `startRecording` 内，若 `PcmRecorder.isSupported()` 则与 SpeechRecognition **并行**启动 PCM 采集（复用同一 `MediaStream`，避免二次 getUserMedia）。
- [ ] 2.2 `finishRecording` 时，停止 PCM 采集拿到 `Int16Array`，与最终 transcript 一起通过新增回调 `onAudio?(pcm, transcript)` 暴露给上层；无 PCM（不支持/空）时不回调。
- [ ] 2.3 `cleanup` 中 dispose PCM recorder，确保 AudioContext 释放。
- [ ] 2.4 单测：补充 useVoiceInput 在不支持 AudioWorklet 时不抛错、正常路径下 onAudio 被调用（mock PcmRecorder）。

## 3. 后端：发音评测 HTTP 路由

- [ ] 3.1 新增 `server/src/http/pronunciation.routes.ts`：`POST /pronunciation/assess`，用 `express.raw({ type: 'application/octet-stream', limit: '5mb' })` 解析 PCM body；从 query 取 `referenceText`、`turnId`。
- [ ] 3.2 调用注入的 `IPronunciationService.assess(pcmArrayBuffer, referenceText)`，把返回的 `PronunciationResult` 的 `turnId` 补上 query 值后 JSON 返回。
- [ ] 3.3 缺 referenceText / 空 body → 返回 400；评测内部失败由服务层降级（estimate）兜底，路由层只兜未预期异常返回 500。
- [ ] 3.4 修改 `server/src/http/app.ts`：挂载 pronunciationRouter（在全局 `express.json` 之外/之前，保证 raw 解析生效）。
- [ ] 3.5 单测 `server/src/http/pronunciation.routes.test.ts`：mock service，验证 200 正常返回结构、400 缺参、turnId 正确回填。

## 4. 前端：API 封装 + session store

- [ ] 4.1 新增 `web/src/api/pronunciation.ts`：`assessPronunciation(pcm: Int16Array, referenceText: string, turnId: string): Promise<PronunciationResult | null>`，用 `fetch` POST `application/octet-stream`，失败返回 null（静默）。
- [ ] 4.2 修改 `web/src/store/session.ts`：新增 `pronunciationScores: PronunciationResult[]` 状态与 `addPronunciation(r)` action；`reset()` 一并清空。
- [ ] 4.3 单测：store 增删与 reset 行为。

## 5. 前端：对话页接线（异步评测）

- [ ] 5.1 修改 `web/src/pages/Conversation.tsx`：给 `useVoiceInput` 传 `onAudio`，回调里异步调用 `assessPronunciation(pcm, transcript, turnId)`，成功则 `addPronunciation`。
- [ ] 5.2 turnId 对齐：评测用的 turnId 必须与该轮 user turn 的 id 一致，便于报告页按句关联。
- [ ] 5.3 评测请求不 await 阻塞 `handleUserMessage`（fire-and-forget + 错误 catch）。

## 6. 前端：报告页展示真实发音分

- [ ] 6.1 修改报告生成/展示逻辑：若 `pronunciationScores` 非空，发音维度取其平均（accuracy 为主），覆盖 LLM 估算的 pronunciation。
- [ ] 6.2 报告页明确标注数据来源：有声学分 → "🎙️ 声学评测"，无 → "本次为文字输入，发音未评测"。
- [ ] 6.3 （可选）展示逐词分数 wordScores 的高亮/最差几个词，作为发音改进点。
- [ ] 6.4 文字模式全程无声学分时，发音维度不拉低综合分（按现有"无数据"方式处理）。

## 7. 验证与回归

- [ ] 7.1 `npm test -w web` 全绿（含新增 pcm-recorder / store / hook 用例）。
- [ ] 7.2 `npm test -w server` 全绿（含新增 route 用例）。
- [ ] 7.3 手工联调：Chrome 开麦说一句 → 后端日志见讯飞 ISE 调用 → 报告页发音分为真实分；说得标准 vs 含糊，分数有明显差异。
- [ ] 7.4 手工回归：文字模式 → 报告页发音维度显示"未评测"，其余四维正常。
- [ ] 7.5 `npm run lint`（web + server）通过。

## 8. OpenSpec 校验与归档准备

- [ ] 8.1 PR 描述链接 `openspec/changes/add-pronunciation-assessment/`，列明新增 capability `pronunciation-assessment`。
- [ ] 8.2 合并后将 delta 同步回 `openspec/specs/`。
