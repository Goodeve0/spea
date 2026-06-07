## Why

目前用户在对话页用语音说话时有两个体验问题：

1. **最终消息没有标点**——服务端 SenseVoice 默认返回纯字母小写文本（`holidays this is my first time to speak`），浏览器 SpeechRecognition 的 final chunk 拼接也是用空格直连，导致句子读起来像一段没断句的流水账，影响 LLM 对句意/语气的判断与课后纠错的可读性。
2. **录音预览不是真增量**——`useVoiceInput` 用 `pending(final 累计) + 当前 interim` 的方式拼接预览：每当一个 interim 段被识别引擎"猜词修正"，整段 interim 文本就会被新 interim **整段替换**，UI 视觉上是「先出 `holidays` → 整体闪一下变成 `holidays this` → 再变成 `holidays this is`…」的覆盖式刷新，看起来像在反复改写，而不是「一个词接一个词追加」的打字机效果。

两个问题合起来让用户觉得「我说的话被吞了一截再重写一次」，体感差。本变更专门修这两个点。

## What Changes

- **服务端 ASR 文本补标点**：在 `server/src/http/asr.routes.ts` 的 `cleanSenseVoiceText` 之后增加一个轻量补标点环节——
  - 调 SenseVoice 时显式开启其内置的 ITN/标点选项（如 `inverse_text_normalization=true`、`enable_punctuation=true` 这类参数，按 SiliconFlow 真实参数名取）。
  - 若上游返回仍无标点，做一次基于规则的本地兜底：句首单词大写、句尾按 VAD 提交点补 `.` / `?`（疑问词起句补 `?`）、保留中间已有标点。
  - 不动 `cleanSenseVoiceText` 已有的控制标记/emoji 清洗职责。
- **浏览器识别 final chunk 拼接补标点**：在 `useVoiceInput.ts` 的 `result.isFinal` 分支，把当前 chunk 与 `pendingTranscriptRef` 拼接时按规则首字母大写 + 句末加句号；切到下一句时新句首字母大写。仅作用于浏览器无服务端 ASR 兜底的场景，避免双重处理。
- **真·增量预览**：改写 `useVoiceInput` 的预览拼接逻辑——
  - 维护 `committedWords: string[]`（已稳定的词）和 `interimWords: string[]`（当前 interim）。
  - 每次 interim 更新时，**仅追加**新增的尾部词，已经出现过的前缀词不再触发整段重排，UI 用 `committedWords + interimWords` 渲染，达到逐词追加的效果。
  - 用 `Conversation.tsx` 已有的录音预览节点直接展示该字符串，不改外层组件契约。
- **回归测试**：
  - `server/src/http/asr.routes.test.ts` 增加「补标点」用例。
  - 新增 `web/src/hooks/useVoiceInput.test.ts`（若不存在则新建）覆盖 interim 增量拼接、final chunk 标点拼接两条路径。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `voice-input-silence-stop`：本变更不改静默自动停止的行为，但需在该 spec 里**新增一节**描述「录音过程中的实时预览必须是逐词追加的增量字符串」，并新增一条「最终提交的转写文本应包含句首大写与句末标点」的要求。如果不存在该 spec，则归到一个新建 capability：`voice-input-transcript`。

> 备注：`openspec/specs/` 下当前没有 `voice-input-silence-stop`（其只在 `archive/` 里），因此本变更按**新建** capability 处理：
>
> - **新建** `voice-input-transcript`：覆盖语音输入的实时预览渲染规则与最终转写文本规范化规则。

### New Capabilities（修订）

- `voice-input-transcript`：定义语音输入路径下「录音中预览」与「最终转写文本」的契约——预览必须逐词增量追加，最终文本必须经过标点 + 句首大写规范化。

## Impact

- **代码**：
  - `server/src/http/asr.routes.ts`（SenseVoice 调用参数 + 兜底补标点）
  - `web/src/hooks/useVoiceInput.ts`（`committedWords`/`interimWords` 增量拼接 + final chunk 规范化）
  - `web/src/audio/speech-recognition.ts` 仅在需要暴露增量 diff 时改动；优先在 hook 层处理，保持 `BrowserSpeechRecognition` 接口不变
- **测试**：
  - `server/src/http/asr.routes.test.ts` 新增 punctuation 用例
  - `web/src/hooks/useVoiceInput.test.ts` 新增（覆盖逐词预览 + 标点拼接）
- **依赖**：不新增；如 SenseVoice 必须额外参数走 SiliconFlow 接口，仅改请求体字段
- **配置**：无新环境变量
- **兼容性**：服务端 ASR 路径与浏览器 ASR 路径行为对齐；不影响 PCM 发音评测、TTS、对话 LLM 链路
