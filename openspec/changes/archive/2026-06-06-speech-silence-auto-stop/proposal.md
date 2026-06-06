## Why

对话页「Tap to speak」当前在 Web Speech API 返回 `isFinal` 结果后立即结束录音并提交给 LLM，用户感觉「刚说完或稍一停顿就立刻结束」，无法自然留出思考/换气时间。需要在保留手动打断的前提下，引入基于静音检测的自动结束机制，让录音在持续静音约 1～3 秒后再提交。

## What Changes

- 语音输入模式新增**静音超时自动结束**：检测到用户已开口说话后，若连续静音达到阈值（默认 **2 秒**，可配置为 1～3 秒），自动停止录音并提交当前识别文本
- **保留手动停止**：用户点击麦克风按钮仍可立即结束录音
- **延迟提交策略**：收到 `isFinal` 识别结果时不再立即提交；改为更新待提交文本，等待静音计时器到期或用户手动停止后再提交
- **未开口静音不提交**：录音开始后若用户从未说话（全程无有效语音），超时后静默结束，不触发 LLM 对话
- 复用或扩展现有 `BrowserAudioRecorder` 的 VAD 思路，与 `BrowserSpeechRecognition` 协同工作（具体方案见 design.md）

## Capabilities

### New Capabilities

- `voice-input-silence-stop`: 对话页语音输入的静音检测、超时自动结束、手动停止与提交时机控制

### Modified Capabilities

（无——现有 `openspec/specs/` 中无语音输入相关主规格，本次为新增能力）

## Impact

- **前端**
  - `web/src/pages/Conversation.tsx` — 录音开始/停止/提交流程、静音回调接入
  - `web/src/audio/speech-recognition.ts` — 可能需要暴露 interim/final 文本聚合，或调整 continuous 模式下的结束语义
  - `web/src/audio/recorder.ts` — 复用或抽取 VAD 静音检测逻辑（当前 700ms 阈值需调整为可配置）
- **后端**：无变更（仍使用浏览器端 ASR，不走服务端）
- **依赖**：无新 npm 包；继续使用 Web Speech API + Web Audio API
