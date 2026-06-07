## 1. 前端：PCM 采集层（AudioWorklet + 降采样）

- [x] 1.1 新增 `web/public/pcm-worklet.js`：AudioWorklet processor，每次 `process()` 把输入 Float32 帧拷贝并 `port.postMessage` 回主线程；无输入时静默。
- [x] 1.2 新增 `web/src/audio/pcm-recorder.ts`：start/stop/dispose/isSupported；stop 内做抗混叠低通 + 降采样到 16kHz + Int16 转换。
- [x] 1.3 单测 `web/src/audio/pcm-recorder.test.ts`：13 个用例覆盖 merge/downsample/floatToInt16/lowPass。

## 2. 前端：useVoiceInput 并行录 PCM

- [x] 2.1 `startRecording` 内复用同一 `MediaStream` 并行启动 PcmRecorder（仅 isSupported 时）。
- [x] 2.2 `finishRecording` 先异步抽取 PCM，与 transcript 一起通过 `onAudio(pcm, transcript)` 回调；无 PCM 不回调。
- [x] 2.3 `cleanup` 中 dispose PCM recorder。
- [~] 2.4 Hook 集成单测：跳过（核心 PCM 逻辑已由 pcm-recorder.test.ts 覆盖，isSupported 守卫保证 jsdom 下走降级路径，重度 mock 性价比低）。

## 3. 后端：发音评测 HTTP 路由

- [x] 3.1 新增 `server/src/http/pronunciation.routes.ts`：`express.raw` 解析 octet-stream PCM，5mb 上限；query 取 referenceText/turnId。
- [x] 3.2 调用 `IPronunciationService.assess()`，turnId 回填后返回。
- [x] 3.3 缺 referenceText / 空 body 返回 400；服务层降级兜底。
- [x] 3.4 `app.ts` 挂载 pronunciationRouter。
- [x] 3.5 单测 `pronunciation.routes.test.ts`：4 个用例（正常/缺参/空 body/turnId 回填）。

## 4. 前端：API 封装 + session store

- [x] 4.1 新增 `web/src/api/pronunciation.ts`：assessPronunciation，失败返回 null。
- [x] 4.2 `store/session.ts`：新增 pronunciationScores + addPronunciation；reset 清空。
- [~] 4.3 store 单测：跳过（trivial zustand action，已由对话集成路径覆盖）。

## 5. 前端：对话页接线（异步评测）

- [x] 5.1 `Conversation.tsx` 传 onAudio，异步调用 assessPronunciation，成功则 addPronunciation。
- [x] 5.2 turnId 对齐：按 transcript 文本匹配最近的 user turn id。
- [x] 5.3 评测 fire-and-forget，不阻塞 handleUserMessage。

## 6. 前端：报告页展示真实发音分

- [x] 6.1 `mergeAcousticScores` 用声学 accuracy 覆盖发音分、融合流利度（6 单测）。
- [x] 6.2 报告页标注来源：acoustic → "🎙️ 声学评测"；none → "未评测 / 本次无录音"。
- [x] 6.3 展示逐词薄弱分（score < 80 的词，最多 6 个）。
- [x] 6.4 未评测时发音维度排除出综合分与雷达图，不拉低分数。

## 7. 验证与回归

- [x] 7.1 `npm test -w web` 全绿（10 文件 84 测试，含 pcm-recorder + report-generator 新增）。
- [x] 7.2 `npm test -w server` 全绿（16 文件 139 测试，含 pronunciation.routes 新增）。
- [ ] 7.3 手工联调：Chrome 开麦说一句 → 后端日志见讯飞 ISE 调用 → 报告页发音分为真实分；标准 vs 含糊有差异。
- [ ] 7.4 手工回归：文字模式 → 报告页发音维度显示"未评测"，其余四维正常。
- [ ] 7.5 `npm run lint`（注：web 端 tsc 有 2 处预存测试文件错误，与本变更无关）。

## 8. OpenSpec 校验与归档准备

- [ ] 8.1 PR 描述链接 `openspec/changes/add-pronunciation-assessment/`，列明新增 capability `pronunciation-assessment`。
- [ ] 8.2 合并后将 delta 同步回 `openspec/specs/`。
