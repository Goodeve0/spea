## Why

用户在 AI 自动朗读某条消息时通过麦克风打断（开始说话），待说完并收到新回复后，旧朗读与新朗读会叠加播放，出现两个声音。这严重干扰对话练习体验，且与「同一时刻只有一个 TTS 声源」的产品预期不符。现有 `tts-engine` 规格仅覆盖「切换引擎」时的互斥，未覆盖「打断后继续对话」场景，需补齐并修复实现。

## What Changes

- 定义并落实 **全局单声源** 规则：任意时刻（含打断、跟读、引擎回退）最多只有一个 TTS 播放会话处于活跃状态。
- 用户打断 AI 朗读（开始录音或发送文字）时，**立即且彻底**停止当前及已排队的 TTS，并作废旧会话的 `onEnd` / 回退回调，避免迟到的回调再次触发播放。
- 讯飞引擎 `stop()` 须取消已调度但未播放完的音频帧；浏览器引擎 `stop()` 须忽略被取消 utterance 的后续事件。
- `Conversation.tsx` 中 `stopSpeaking` / `speakReply` / 跟读入口统一走同一套「先停后播」协调逻辑，防止打断后新回复与残留音频重叠。
- 补充自动化测试覆盖打断后仅一次 `onEnd`、无重叠 `speak` 等关键路径。

## Capabilities

### New Capabilities

（无 — 本变更为既有 TTS 行为约束的修复与规格补全）

### Modified Capabilities

- `tts-engine`: 新增「打断与单声源」需求，明确 `stop()` 后不得再有旧会话音频输出或回调触发新播放；与现有「引擎切换中断保护」一并构成全局互斥规则。
- `read-aloud`: 补充「用户打断 AI 自动朗读」场景——打断后朗读按钮与 `readingTurnId` 状态立即复位，且后续新自动朗读不得与被打断的音频重叠。

## Impact

- **前端音频层**：`web/src/audio/iflytek-tts-client.ts`（stop 取消已排队帧、generation token）、`web/src/audio/speech-synthesis.ts`（cancel 后忽略 stale 回调）
- **对话页**：`web/src/pages/Conversation.tsx`（`stopSpeaking`、`speakReply`、录音打断流程）
- **状态**：`web/src/store/session.ts`（`isAiSpeaking`、`readingTurnId` 与打断同步）
- **测试**：`web/src/audio/*.test.ts`、必要时 `Conversation` 相关单测
- **规格增量**：`openspec/changes/fix-tts-interrupt-double-voice/specs/tts-engine/`、`specs/read-aloud/`
- **无后端 / 契约变更**：不涉及 `shared/contracts.ts` 或 WebSocket 消息类型
