# voice-input-silence-stop Specification

## Purpose
定义对话页语音输入（Tap to speak）的静音检测、超时自动结束、手动停止与提交时机控制行为。

## ADDED Requirements

### Requirement: 静音超时自动结束录音

用户开口说话后，系统 SHALL 在用户停止说话且连续静音达到 `SILENCE_DURATION_MS`（默认 **2000ms**）时自动结束录音。自动结束 MUST 通过 VAD（Web Audio Analyser 能量检测）判定静音，而非依赖 Web Speech API 的 `isFinal` 事件。

#### Scenario: 说完话停顿 2 秒后自动提交
- **WHEN** 用户点击麦克风开始录音，说出 "Hello how are you"，随后停止说话并保持静音 ≥ 2 秒
- **THEN** 录音自动结束，聚合后的识别文本提交给 LLM，麦克风按钮恢复空闲态

#### Scenario: 句间短暂停顿不结束
- **WHEN** 用户说 "Hello" 后停顿 0.5 秒继续说 "how are you"
- **THEN** 录音不结束，识别文本持续更新，直至最终静音 ≥ 2 秒

#### Scenario: 从未开口不提交
- **WHEN** 用户点击麦克风开始录音，但全程未说话（无 VAD 能量超阈值、无识别文本），静音 ≥ 2 秒
- **THEN** 录音静默结束，不调用 LLM，不新增用户消息

### Requirement: 手动停止录音

用户 MUST 能在录音期间点击麦克风按钮立即停止。手动停止 SHALL 与静音自动停止走同一提交流程。

#### Scenario: 手动点击停止并提交
- **WHEN** 用户正在录音且已有识别文本 "Nice to meet you"，点击麦克风按钮
- **THEN** 录音立即停止，文本 "Nice to meet you" 提交给 LLM

#### Scenario: 手动停止无文本不提交
- **WHEN** 用户开始录音但未说话，立即点击麦克风停止
- **THEN** 录音停止，不触发 LLM 对话

### Requirement: 延迟提交策略

收到 Web Speech API 的 `isFinal=true` 识别结果时，系统 MUST NOT 立即结束录音或提交消息。系统 SHALL 将 final 文本追加到 `pendingTranscript` 缓冲区（空格拼接），并继续监听后续语音输入。

#### Scenario: isFinal 不立即提交
- **WHEN** 录音中收到 `isFinal` 结果 "Hello there"
- **THEN** `pendingTranscript` 更新为 "Hello there"，录音继续，不调用 `handleUserMessage`

#### Scenario: 多段 isFinal 聚合提交
- **WHEN** 录音中先后收到 `isFinal` "Hello" 和 `isFinal` "how are you"，随后静音 ≥ 2 秒
- **THEN** 提交文本为 "Hello how are you"（空格拼接后的完整内容）

### Requirement: 识别文本实时预览

录音期间，系统 SHALL 在 UI 上显示当前识别进度：`interimResults` 显示为 partial 文本；收到 `isFinal` 后 partial 文本清空，已确认内容保留在内部缓冲区。

#### Scenario: interim 文本实时显示
- **WHEN** 用户正在说话，Web Speech API 返回 interim 结果 "Hello ho"
- **THEN** 对话页显示 partial 文本 "Hello ho"

#### Scenario: final 后 partial 清空
- **WHEN** 收到 `isFinal` "Hello how are you"
- **THEN** partial 文本清空，UI 不再显示 interim 内容（缓冲区已保存）

### Requirement: 静音计时器重置

静音倒计时 MUST 在以下事件发生时重置（重新开始计时）：
- VAD 检测到用户说话（音频能量超过阈值）
- 收到新的 `isFinal` 识别结果
- interim 识别文本发生变化

#### Scenario: 说话重置静音计时
- **WHEN** 用户停止说话 1.5 秒后再次开口
- **THEN** 静音计时器被重置，不会在 1.5 秒时触发结束

#### Scenario: ASR 活动重置静音计时
- **WHEN** VAD 已停止检测说话，但 Web Speech API 仍返回新的 interim 文本
- **THEN** 静音计时器被重置，等待新的静音窗口

### Requirement: 已开口判定

系统 SHALL 维护 `hasSpoken` 状态。当 VAD 检测到说话 **或** `pendingTranscript`/interim 文本非空时，`hasSpoken` MUST 设为 `true`。仅当 `hasSpoken === true` 且静音计时器到期时，才执行自动提交。

#### Scenario: 仅 VAD 检测到说话但无识别文本
- **WHEN** VAD 检测到说话但 Web Speech API 未返回任何文本，随后静音 ≥ 2 秒
- **THEN** 录音结束，不提交（无有效文本）

#### Scenario: 识别文本但 VAD 未触发
- **WHEN** Web Speech API 返回识别文本但 VAD 能量未超阈值（如远场小声），随后静音 ≥ 2 秒
- **THEN** `hasSpoken` 为 true，识别文本正常提交

### Requirement: 静音时长常量

默认静音超时时长 MUST 定义为常量 `SILENCE_DURATION_MS = 2000`，存放于 `web/src/audio/voice-input-constants.ts`。`SilenceDetector` SHALL 接受可配置的 `silenceDurationMs` 参数，默认读取该常量。

#### Scenario: 默认静音时长
- **WHEN** 未传入自定义 `silenceDurationMs` 创建 `SilenceDetector`
- **THEN** 静音超时为 2000ms

### Requirement: no-speech 错误容错

Web Speech API 在长时间静音后可能触发 `no-speech` 错误。系统 MUST 静默处理该错误（不显示错误提示）。若此时 `pendingTranscript` 非空，SHALL 视为正常结束并提交已有文本。

#### Scenario: no-speech 但有待提交文本
- **WHEN** 录音中已有 `pendingTranscript` "Hello"，Web Speech API 触发 `no-speech` 错误
- **THEN** 不显示错误提示，提交 "Hello" 给 LLM

#### Scenario: no-speech 且无文本
- **WHEN** 录音中无识别文本，Web Speech API 触发 `no-speech` 错误
- **THEN** 不显示错误提示，静默结束录音
