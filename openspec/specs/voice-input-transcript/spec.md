# voice-input-transcript Specification

## Purpose
定义语音输入录音预览的逐词增量追加行为，以及服务端/浏览器 ASR 最终转写的标点与句首大写规范化规则。

## Requirements

### Requirement: 录音过程实时预览必须逐词增量追加

语音输入开始后，UI 中的录音预览（`recordingPreview`）SHALL 以逐词追加的形式呈现：每当浏览器 `SpeechRecognition` 返回更长的 interim 结果时，预览只在已有文本末尾**追加新词**，不得整段替换或重排已稳定显示的前缀词。

`final` 段落落定时，对应的 interim 词组 MUST 平滑转为已稳定文本（`committed`），后续 interim 不影响已稳定部分。

#### Scenario: interim 文本逐词增长

- **WHEN** 用户连续说出 `holidays`、`holidays this`、`holidays this is`、`holidays this is my first time to speak`，浏览器识别引擎依次返回这四个 interim 字符串
- **THEN** 预览字符串 SHALL 严格按 `holidays` → `holidays this` → `holidays this is` → `holidays this is my first time to speak` 的顺序增长
- **AND** 在每一步切换时，已经显示过的前缀词（如 `holidays`、`this`、`is`）MUST NOT 在 UI 上发生位置抖动或字符闪烁

#### Scenario: 单个 interim 段落转 final

- **WHEN** 浏览器返回 `result.isFinal === true` 的 chunk `holidays this is my first time to speak`
- **THEN** 该 chunk 中的所有词 SHALL 进入 `committed` 部分，`interim` 部分清空
- **AND** UI 上预览字符串内容保持不变，只是状态由"未稳定"切换为"已稳定"

#### Scenario: 多次 final chunk 顺序累加

- **WHEN** 用户先说出 `hello everyone` 拿到 final，再继续说 `how are you` 拿到 final
- **THEN** 录音预览 SHALL 显示 `hello everyone how are you`（按 final 到达顺序拼接）

### Requirement: 最终转写文本必须完成标点与句首大写规范化

调用方（`onTranscript` 回调消费者）拿到的最终文本 SHALL 满足：

- 每个句子的首字母大写（包含独立单词构成的"短句"）。
- 句末根据自然停顿补一个句末标点：`.`（陈述）、`?`（疑问，启发自起句疑问词）、`!`（仅在上游显式给出时保留）。
- 句中若上游已含合法标点（`,` `.` `?` `!` `;` `:`），则保留并不重复添加。
- 不得在缩写、所有格等位置错误大写或断句（如 `it's`、`I'd`、`John's` 不应被切句）。

该规范化 SHALL 同时覆盖以下两条转写来源：

1. **服务端 ASR**（`POST /asr` 调 SiliconFlow SenseVoice）：在路由处理函数返回前完成。
2. **浏览器 ASR**（`useVoiceInput` 中 final chunk 累计）：在 `pendingTranscriptRef` 拼接时完成。

服务端 ASR 路径 SHALL 优先使用上游模型的标点能力（如 SenseVoice / SiliconFlow 提供的 `enable_punctuation` / `inverse_text_normalization` 参数）；上游未给标点时 MUST 退化到本地规则补标点。

#### Scenario: 服务端 ASR 上游已带标点

- **WHEN** SenseVoice 返回 `holidays, this is my first time to speak.`
- **THEN** `POST /asr` 响应体的 `text` 字段 SHALL 等于 `Holidays, this is my first time to speak.`
- **AND** 不得追加多余标点

#### Scenario: 服务端 ASR 上游未带标点

- **WHEN** SenseVoice 返回 `holidays this is my first time to speak`
- **THEN** `POST /asr` 响应体的 `text` 字段 SHALL 等于 `Holidays this is my first time to speak.`

#### Scenario: 服务端 ASR 起句疑问词

- **WHEN** SenseVoice 返回 `where are you from`
- **THEN** `POST /asr` 响应体的 `text` 字段 SHALL 等于 `Where are you from?`

#### Scenario: 浏览器 ASR 多 final chunk 拼接

- **WHEN** 浏览器 `SpeechRecognition` 先后给出两个 final chunk：`hello everyone` 与 `how are you`
- **AND** 未启用服务端 ASR 兜底
- **THEN** 最终经 `onTranscript` 回调发出的字符串 SHALL 等于 `Hello everyone. How are you?`

#### Scenario: 缩写不被错误断句

- **WHEN** 转写源文本为 `it's been a while`
- **THEN** 规范化后字符串 SHALL 等于 `It's been a while.`
- **AND** `it's` 中的 `s` 前后不得被插入额外标点或额外大写

#### Scenario: 中间已有逗号被保留

- **WHEN** 上游 ASR 返回 `well, that's interesting`
- **THEN** 规范化后字符串 SHALL 等于 `Well, that's interesting.`
- **AND** 已有 `,` 不被改写或重复添加

### Requirement: 规范化不得破坏 SenseVoice 控制标记清洗职责

服务端 ASR 路径上现有的 `cleanSenseVoiceText` MUST 仍然先剥除 SenseVoice 输出的控制标记（`<|en|>`、`<|HAPPY|>` 等）与情感 emoji，再交由标点/大写规范化步骤处理。两步顺序固定，不得交换。

#### Scenario: 同时含控制标记与缺失标点

- **WHEN** SenseVoice 返回 `<|en|><|NEUTRAL|>holidays this is my first time to speak😊`
- **THEN** `POST /asr` 响应体的 `text` 字段 SHALL 等于 `Holidays this is my first time to speak.`
- **AND** 不得保留任何 `<|...|>` 控制标记或 emoji

### Requirement: 增量预览能力必须不影响 VAD 静默自动停止

引入逐词增量预览后，VAD 静默自动停止行为 MUST 保持不变：当 interim 或 final 任意来源带来新词时，静默计时器 SHALL 被重置；当超过静默阈值无任何新词时，录音 SHALL 按既有逻辑结束并触发最终规范化。

#### Scenario: 持续追加期间不会被误判静默

- **WHEN** 用户每次开口间隔 < 静默阈值，预览以逐词追加方式增长
- **THEN** 录音 SHALL 持续进行，不被自动结束

#### Scenario: 增量预览结束后静默触发收尾

- **WHEN** 预览停止追加新词且静默时长达到阈值
- **THEN** 录音 SHALL 触发 `finishRecording` 走最终规范化路径
- **AND** `onTranscript` 收到的最终字符串 MUST 满足上一条 Requirement 的标点与大写约束
