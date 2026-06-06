## Context

对话页语音输入当前流程（`Conversation.tsx` + `BrowserSpeechRecognition`）：

1. 用户点击麦克风 → 启动 Web Speech API（`continuous=true`, `interimResults=true`）
2. 收到 `isFinal=true` 的识别结果 → **立即** `recognition.stop()` 并调用 `handleUserMessage()`
3. 用户可手动点击麦克风停止，但不会提交已识别的 interim 文本

问题根源：`isFinal` 在浏览器中往往在用户句间短暂停顿时就触发，不等同于「用户说完了」。项目内 `BrowserAudioRecorder`（`recorder.ts`）已有基于 Web Audio Analyser 的 VAD 静音检测（700ms），但**未接入**对话页录音流程。

## Goals / Non-Goals

**Goals:**
- 用户开口说话后，连续静音达到 **2 秒**（默认）自动结束录音并提交
- 保留手动点击麦克风立即停止并提交
- `isFinal` 结果不再触发立即提交，而是更新待提交文本并继续监听
- 用户从未开口时，静音超时后静默结束，不触发 LLM
- 提交时使用已聚合的完整识别文本（含多段 `isFinal` 拼接）

**Non-Goals:**
- 设置面板中暴露静音时长配置（v1 使用代码常量，默认 2000ms）
- 替换 Web Speech API 为服务端 ASR
- 引入 `@ricky0123/vad-web` 等新依赖
- 修改后端 WebSocket 协议

## Decisions

### 1. 静音检测：抽取 VAD 模块 vs 仅依赖 Web Speech API

**决策：** 从 `recorder.ts` 抽取独立的 `SilenceDetector`（Web Audio Analyser），与 `BrowserSpeechRecognition` **并行**运行；以 VAD 静音计时作为结束录音的主触发条件。

**理由：**
- Web Speech API 的 `isFinal` 时机不可控，无法可靠表示「用户说完了」
- 项目已有 VAD 实现，700ms 过短；抽取后可配置为 2000ms
- VAD 检测真实音频能量，比 ASR 语义分段更符合用户「停顿几秒再提交」的预期

**替代方案：** 在 `isFinal` 后启动 debounce 计时器 — 被否决，首个 `isFinal` 仍可能过早，且无法区分「未开口」与「已说完」。

### 2. 提交流程：延迟提交 + 文本缓冲

**决策：** 录音期间维护 `pendingTranscript` 字符串：
- `interimResults` → 更新 UI 的 `partialText`（现有行为）
- `isFinal` → 追加到 `pendingTranscript`（空格拼接），清空 interim 显示，**不**调用 `handleUserMessage`
- VAD 静音到期或手动停止 → 若 `pendingTranscript.trim()` 非空则提交，否则静默结束

**理由：**
- 支持用户说多句后再一次性提交（句间 `isFinal` 不会截断会话）
- 手动停止与自动停止走同一 `finishRecording()` 路径，逻辑统一

### 3. 「已开口」判定：VAD 或识别文本

**决策：** `hasSpoken = true` 当满足任一条件：
- VAD 检测到音频能量超过阈值（与 `recorder.ts` 相同，`avg > 15`）
- `pendingTranscript` 或 interim 文本非空

仅当 `hasSpoken === true` 且静音计时器到期时才自动提交；若从未开口，静音到期只结束录音不提交。

**理由：**
- 避免环境噪音误触发 VAD 但未识别出文字时提交空消息
- 识别出文字但 VAD 阈值未过（如远场小声）仍可正常提交

### 4. 静音阈值与计时重置

**决策：**
- 默认 `SILENCE_DURATION_MS = 2000`（常量，放在 `web/src/audio/voice-input-constants.ts`）
- VAD 检测到说话时清除静音计时器；停止说话后开始计时
- 收到新的 `isFinal` 或 interim 文本变化时也重置静音计时器（ASR 活动视为「还在说」）

**理由：**
- 2 秒在「响应速度」与「换气容忍」之间平衡（用户原诉求 1～3 秒）
- ASR 活动重置避免 VAD 误判句间停顿

### 5. 模块划分

**决策：**

```
web/src/audio/silence-detector.ts   ← 从 recorder.ts 抽取，可配置 silenceDurationMs
web/src/audio/voice-input-constants.ts  ← SILENCE_DURATION_MS 等常量
web/src/pages/Conversation.tsx      ← 编排 recognition + silenceDetector + finishRecording
web/src/audio/recorder.ts           ← 复用 SilenceDetector，删除重复 VAD 逻辑
```

**理由：**
- 单一职责：VAD 与 ASR 解耦，Conversation 只做编排
- `recorder.ts` 未来录音场景也能复用同一检测器

### 6. 手动停止行为

**决策：** 点击麦克风（录音中）→ 调用 `finishRecording({ reason: 'manual' })`，与自动停止相同提交逻辑。

**理由：** 用户预期「点一下 = 我说完了」，与静音自动结束一致。

## Risks / Trade-offs

- **[Risk]** VAD 阈值 `avg > 15` 在不同麦克风/环境敏感度不一致 → **缓解**：与现有 recorder 保持一致；ASR 文本活动可补偿；后续可调阈值
- **[Risk]** `continuous` 模式下 Web Speech API 在长时间静音后可能触发 `no-speech` 错误 → **缓解**：`onError` 中对 `no-speech` 静默处理；若已有 `pendingTranscript` 则视为正常结束并提交
- **[Risk]** 并行运行 VAD 与 Recognition 各占用一份 mic stream → **缓解**：SilenceDetector 与 Recognition 共用同一 `getUserMedia` stream（Recognition 不直接占 stream，但 VAD 需要；仅 VAD 申请 stream，Recognition 使用浏览器内置通道）
- **[Risk]** 2 秒对快速对话偏长 → **缓解**：手动停止始终可用；常量易于后续改为可配置

## Migration Plan

纯前端行为变更，无数据库/API 迁移。部署后即生效。回滚：恢复 `Conversation.tsx` 中 `isFinal` 立即提交逻辑即可。

## Open Questions

无。
