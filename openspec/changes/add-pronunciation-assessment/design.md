## Context

发音评测要让讯飞 ISE 给出可信声学分，必须喂它 **16kHz / 16bit / 单声道 raw PCM**（见 [`pronunciation-iflytek.service.ts`](server/src/modules/pronunciation-iflytek.service.ts) 的 `auf: 'audio/L16;rate=16000'`）。浏览器 `MediaRecorder` 产出的是 webm/opus（有损压缩），无法直接使用。

方案选型（已与用户确认选 A）：
- **方案 A（选定）**：前端 AudioWorklet 抓 raw PCM → JS 降采样到 16kHz。后端零依赖、部署不变、无有损压缩、声学保真度最高。
- 方案 B（未选）：前端传 webm，后端 ffmpeg 转码。省前端代码但需系统依赖 + opus 有损损失。

## Goals / Non-Goals

**Goals**
- 报告页发音分来自讯飞真实声学评测，而非 LLM 猜测。
- 不破坏现有"浏览器 SpeechRecognition + 前端 LLM 直连"主流程。
- 不引入 ffmpeg / 不增加 npm 运行时依赖。
- 评测异步进行，不增加对话响应延迟。

**Non-Goals**
- 不做"跟读式"标准发音对比（referenceText 用 ASR 识别结果，是"自由说"评测）。
- 不解决 Safari/iOS 不支持 SpeechRecognition 的问题（本期沿用文字模式降级）。
- 不做实时逐字发音高亮（仅在报告页汇总展示）。
- 不改 WS 服务端 ASR 模式（与本期 HTTP 评测路径并存，互不影响）。

## Decisions

### D1：音频采集走 AudioWorklet，不用已废弃的 ScriptProcessorNode
- `AudioWorkletNode` 在音频线程跑，不阻塞主线程、无 GC 卡顿；`ScriptProcessorNode` 已 deprecated。
- Worklet processor 文件必须是独立 JS 文件（`web/public/pcm-worklet.js`），通过 `audioContext.audioWorklet.addModule(url)` 加载。放 `public/` 下以稳定 URL 提供，避免打包路径问题。
- processor 每次 `process()` 把 128 帧的 Float32 拷出，`port.postMessage` 回主线程累积。

### D2：降采样必须带抗混叠低通滤波
- 麦克风原生采样率通常 44.1k/48kHz，直接抽取到 16kHz 会产生混叠失真，反而损害评测准确度。
- 实现：降采样前先过一个简单的一阶/滑动平均低通（截止 ~7.2kHz，低于 16kHz 奈奎斯特频率 8kHz），再按比例线性插值取样。
- 折中：不引入完整 FIR 滤波库，用轻量滑动平均近似抗混叠，兼顾代码量与质量（对语音频段足够）。

### D3：PCM 以二进制 POST，避免 base64 膨胀
- 一段 10s 的 16kHz 16bit PCM ≈ 320KB；base64 会膨胀 33%。
- 用 `fetch` + `Content-Type: application/octet-stream`，PCM 放 body，referenceText / turnId 放 query string。
- 后端 `express.raw({ type: 'application/octet-stream', limit: '5mb' })` 单独解析该路由，不影响全局 `json` 中间件。

### D4：评测异步、容错降级，绝不阻塞对话
- 录音结束 → 立即把文本发给 LLM（现有流程）+ **并行**异步发起评测请求。
- 评测成功 → 写入 session store `pronunciationScores`；失败/超时 → 静默忽略（console.warn），该轮无发音分。
- 报告页：有声学分则展示真实分并标"声学评测"；全程无声学分（文字模式）则发音维度标"本次无录音，未评测"，不参与综合分计算或以中性方式处理。

### D5：referenceText 用 ASR 识别文本
- 对话是"自由说"，没有标准答案脚本。用浏览器 ASR 识别出的文本作为讯飞 ISE 的 referenceText。
- 含义：评测的是"你说出的这句话，发音标不标准"，而非"你有没有读对某个指定句子"。更贴合口语陪练场景。
- 报告文案需说明这一点，避免用户误解为跟读评分。

### D6：后端路由保持无状态、薄封装
- `/pronunciation/assess` 仅做：取 body PCM → 取 query referenceText → 调用注入的 `IPronunciationService.assess()` → 返回 JSON。
- 复用现有 `createPronunciationService()` 工厂；provider 由环境变量决定（默认 iflytek）。
- 不强制鉴权（评测不涉及用户数据隔离），但限制 body 大小防滥用。

## Risks / Trade-offs

- **AudioWorklet 兼容性**：Chrome/Edge/新 Safari 支持良好；老浏览器降级为不评测。可接受。
- **抗混叠用滑动平均近似**：非理想 FIR，高频滚降不够陡；但对语音主频段（<4kHz）影响可忽略，换来极小代码量。若后续发现评测分系统性偏差，可升级为 windowed-sinc FIR。
- **PCM 体积**：长句（30s+）PCM 可达 1MB 级，已设 5MB 上限兜底；正常对话单轮远低于此。
- **referenceText 噪声**：ASR 识别错误会带偏评测的 reference；但讯飞 ISE 对自由说有一定鲁棒性，且这是对话场景的固有约束。

## Migration Plan

纯增量，无数据迁移：
1. 后端加路由（向后兼容，老前端不调用即无影响）。
2. 前端加 PCM 采集 + 评测调用 + 报告展示。
3. 上线后报告页发音分自动变为真实评测；历史 session 无声学分，照常显示估算/无分。

## Open Questions

- 是否需要把声学分持久化到后端 `Session` 表（当前 schema 有 `radar` JSON 字段，可容纳）？本期先存前端 session store + 报告展示，持久化留待"记忆 AI"阶段一并设计。
