# pronunciation-assessment Specification

## Purpose
将讯飞 ISE 真实声学发音评测接入浏览器 SpeechRecognition 主流程：前端并行采集 16kHz PCM、后端 HTTP 评测、异步不阻塞对话，报告页展示可信发音分并标注来源。

## Requirements

### Requirement: 前端采集 16kHz 单声道 PCM 音频

系统 SHALL 在语音输入模式下，与浏览器 SpeechRecognition **并行**采集用户麦克风的原始音频，并将其转换为 **16kHz / 16bit / 单声道 raw PCM**（Int16），供后端声学评测使用。采集 MUST 复用同一个 `MediaStream`，不得二次请求麦克风权限。

降采样 MUST 在抽取前进行抗混叠低通处理，避免混叠失真影响评测准确度。

当浏览器不支持 `AudioWorklet` 时，系统 MUST 优雅降级为"不采集 PCM、不评测"，且不得影响 SpeechRecognition 与对话主流程。

#### Scenario: 支持 AudioWorklet 时正常采集
- **WHEN** 用户在支持 AudioWorklet 的浏览器（Chrome/Edge）开启语音录音
- **THEN** 系统并行采集 raw 音频，录音结束时产出 16kHz Int16 PCM，长度约为 `原始帧数 × 16000 / 原生采样率`

#### Scenario: 不支持 AudioWorklet 时降级
- **WHEN** 用户浏览器不支持 `AudioWorklet`
- **THEN** PCM 采集被跳过，SpeechRecognition 与对话流程照常工作，报告页该轮无声学发音分

#### Scenario: Int16 取值范围安全
- **WHEN** 将 Float32（[-1, 1]）转换为 Int16 PCM
- **THEN** 所有样本值被 clamp 到 [-32768, 32767]，不发生溢出回绕

### Requirement: 后端提供发音评测 HTTP 接口

系统 SHALL 提供 `POST /pronunciation/assess` 接口，接收二进制 PCM（`application/octet-stream`）作为请求体，并从 query string 读取 `referenceText` 与 `turnId`。接口 MUST 调用既有的发音评测服务（`IPronunciationService`，默认讯飞 ISE），返回 `PronunciationResult`（JSON），其中 `turnId` 字段 MUST 回填为请求传入的值。

请求体大小 SHALL 限制在 5MB 以内。缺少 `referenceText` 或请求体为空时 MUST 返回 400。评测服务内部失败由服务层降级兜底（estimate），路由层仅对未预期异常返回 500。

#### Scenario: 正常评测返回声学分
- **WHEN** 客户端 POST 合法 PCM 且带 `referenceText` 与 `turnId`
- **THEN** 接口返回 200 与 `PronunciationResult`（含 accuracy/fluency/completeness/prosody/wordScores），且 `turnId` 等于请求传入值

#### Scenario: 缺少 referenceText 返回 400
- **WHEN** 客户端 POST PCM 但未提供 `referenceText`
- **THEN** 接口返回 400，不调用评测服务

#### Scenario: 请求体超限被拒
- **WHEN** 客户端 POST 的 PCM 超过 5MB
- **THEN** 接口拒绝该请求，不进行评测

### Requirement: 评测异步进行不阻塞对话

系统 MUST 在录音结束后**异步**发起发音评测请求，且 MUST NOT 阻塞将识别文本发送给 LLM 的对话主流程。评测请求失败或超时时，系统 MUST 静默忽略（仅记录日志），该轮不产生声学发音分，且不影响后续对话。

每次评测请求使用的 `turnId` MUST 与对应的用户发言 turn 的 id 一致，以便报告页按句关联。

#### Scenario: 评测与对话并行
- **WHEN** 用户结束一轮语音输入
- **THEN** 识别文本立即发往 LLM 生成回复，同时评测请求在后台并行进行，二者互不等待

#### Scenario: 评测失败不影响对话
- **WHEN** 评测请求返回错误或超时
- **THEN** 系统记录 warn 日志、该轮无声学分，对话继续正常进行

### Requirement: 报告页展示真实声学发音分并标注来源

课后报告的"发音"维度 SHALL 在存在声学评测分时，使用真实声学分（多轮取平均，以 accuracy 为主）替代 LLM 估算分，并明确标注数据来源为"声学评测"。当整场会话无任何声学分（如全程文字输入）时，发音维度 MUST 标注"本次无录音，未评测"，且 MUST NOT 因此拉低综合分。

#### Scenario: 有声学分时展示真实分
- **WHEN** 会话中至少有一轮产生了声学评测分
- **THEN** 报告发音维度显示声学分平均值，并标注"🎙️ 声学评测"来源

#### Scenario: 全程文字输入时标注未评测
- **WHEN** 整场会话没有任何声学评测分（文字模式或不支持录音）
- **THEN** 报告发音维度显示"本次无录音，未评测"，其余四维（流利/语法/词汇/任务完成）正常展示，综合分不被发音维度拉低
