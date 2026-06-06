## Why

当前课后报告的"发音分"（pronunciation）是 LLM **看文字猜出来的**——LLM 物理上听不到音频，只能根据用户说的文本内容主观打分。这导致：

- 用户发音再差，只要文字内容对，发音分依然很高 → **分数不可信**
- 这是整个评测体系最大的 credibility 缺口，让产品显得"toy"

对比两个竞品（七牛云同题）：
- `ai-oral-practice` 用腾讯 SOE / Azure **真实声学评测**（服务端 ffmpeg 转码 PCM）
- `EchoSpeak-AI` 用 Whisper `avg_logprob` 估算（自己也承认是临时方案）

**好消息**：我们后端早已实现讯飞语音评测（ISE）服务 [`IflytekPronunciationService`](server/src/modules/pronunciation-iflytek.service.ts)，能产出音素级声学分数（accuracy/fluency/completeness/prosody + 逐词分），但它只在"服务端 ASR 模式"的 WS 通道里被调用，而前端实际走的是"浏览器 SpeechRecognition + 前端 LLM 直连"路径，二者无交集 → 讯飞评测能力**从未被主流程用上**。

本变更打通这条链路：把真实声学评测接进现有对话流程，让发音分变成可信的硬数据。

## What Changes

采用**方案 A（前端 AudioWorklet 抓 raw PCM）**，后端讯飞代码不动、零新增系统依赖：

- 前端在每轮语音输入时，**并行**用 Web Audio API（AudioWorklet）采集 raw Float32 音频，做**带抗混叠低通滤波**的降采样到 16kHz，再转成 Int16 PCM。与现有浏览器 SpeechRecognition 同时进行，互不干扰。
- 录音结束后，前端把这段 PCM（连同 ASR 识别出的文本作为 referenceText）异步 POST 到后端新增的 `/pronunciation/assess` 接口。**异步、不阻塞对话**——用户继续说，后台默默攒分。
- 后端新增一个轻量 HTTP 路由，接收 PCM + referenceText，调用既有讯飞 ISE 服务，返回 `PronunciationResult`。
- 前端把每轮的真实声学分累积到 session store，课后报告页用**真实发音分**替代 LLM 估算的发音分；同时明确区分"真实声学评测"与"无音频时的估算"两种来源，诚实展示。

**保持兼容**：
- 文字模式（无录音）/ Safari 不支持录音时 → 无 PCM → 发音维度标注"本次无录音，未评测"，不污染分数。
- LLM 报告的其余四维（流利/语法/词汇/任务完成）逻辑不变。

## Capabilities

### New Capabilities
- `pronunciation-assessment`：真实声学发音评测链路（前端 PCM 采集 → 后端讯飞 ISE → 报告展示）。

### Modified Capabilities
- 无（不修改现有 capability 的契约；报告页对发音维度的"数据来源"做增强属于本 capability 内的展示约束）。

## Impact

- **代码（前端）**
  - 新增 `web/src/audio/pcm-recorder.ts`：AudioWorklet 采集 + 降采样 + Int16 PCM 封装。
  - 新增 `web/public/pcm-worklet.js`：AudioWorklet processor（采集 Float32 帧回传主线程）。
  - 修改 `web/src/hooks/useVoiceInput.ts`：并行启动 PCM 录制，录音结束输出音频 Blob 给上层。
  - 新增 `web/src/api/pronunciation.ts`：`assessPronunciation(pcm, referenceText, turnId)` 封装。
  - 修改 `web/src/store/session.ts`：新增 `pronunciationScores: PronunciationResult[]` 与 `addPronunciation()`。
  - 修改 `web/src/pages/Conversation.tsx`：录音得到文本+PCM 后触发异步评测。
  - 修改 `web/src/pages/Report.tsx`（及报告生成）：发音维度优先使用真实声学分，标注来源。
- **代码（后端）**
  - 新增 `server/src/http/pronunciation.routes.ts`：`POST /pronunciation/assess`。
  - 修改 `server/src/http/app.ts`：挂载路由（注意 PCM body 较大，单独提高 body 上限）。
  - 讯飞服务 [`IflytekPronunciationService`](server/src/modules/pronunciation-iflytek.service.ts) **不改**。
- **行为**：开启麦克风对话后，报告页发音分变为讯飞真实评测；文字模式照常无发音分。
- **依赖/API**：无新增 npm 依赖、无新增系统依赖（不引 ffmpeg）。新增一个 HTTP 接口。
- **风险**：
  - AudioWorklet 在部分老浏览器不支持 → 降级为"无 PCM、不评测"，不影响主流程。
  - 评测有 1-3s 延迟，但因异步攒分、报告页才展示，用户无感。
  - referenceText 是 ASR 识别结果而非标准答案 → 属"自由说"评测而非"跟读"，更贴合对话场景，但报告文案需说明分数含义。
