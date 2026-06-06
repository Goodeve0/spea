# tts-engine Specification

## Purpose
定义 TTS 引擎接口、注册表、切换互斥、打断单声源与不可用回退行为。

## ADDED Requirements

### Requirement: 打断与单声源保护

任意时刻系统 MUST NOT 出现两个 TTS 播放会话同时可听（含同一引擎内连续 `speak`、用户打断后继续对话、讯飞失败兜底到浏览器引擎）。每次新 `speak()` 开始前，引擎 MUST 先停止当前会话；`stop()` 调用后 MUST 立即停止一切可听输出，且旧会话的 `onEnd` / `onError` 回调 MUST NOT 再触发新的播放或 UI 状态变更。

各引擎实现 MUST 使用内部播放代际（generation）机制：`stop()` 或新 `speak()` 使进行中的代际失效，所有异步出口（utterance 事件、WS 音频帧入队、`scheduleEnd` 定时器）在代际不匹配时 MUST 静默丢弃。

#### Scenario: 播放中调用 stop 立即静音
- **WHEN** 浏览器或讯飞引擎正在朗读文本，调用方调用 `engine.stop()`
- **THEN** 用户立即听不到该会话的后续音频输出

#### Scenario: stop 后 onEnd 不触发
- **WHEN** 引擎正在朗读且调用方已注册 `onEnd` 回调，随后调用 `engine.stop()` 且未发起新 `speak()`
- **THEN** 旧会话的 `onEnd` MUST NOT 被调用

#### Scenario: 连续 speak 仅最后一次可听
- **WHEN** 引擎正在朗读句子 A，调用方在不等待 A 结束的情况下调用 `speak(句子 B)`
- **THEN** 句子 A 的音频立即停止，仅句子 B 可听，且仅句子 B 的 `onEnd` 在播放结束后触发

#### Scenario: 讯飞 stop 后迟到 WS 帧被忽略
- **WHEN** 讯飞引擎正在播放 `requestId=R1`，调用 `stop()` 后后端仍推送 `R1` 的 `tts.audio` 帧
- **THEN** 帧 MUST NOT 入队播放，用户听不到 R1 的残留音频

#### Scenario: 浏览器 cancel 后 stale 事件被忽略
- **WHEN** 浏览器引擎正在朗读，调用 `stop()`（内部 `speechSynthesis.cancel()`）后浏览器仍触发旧 utterance 的 `onend` 或 `interrupted` 事件
- **THEN** 旧 utterance 注册的 `onEnd` / `onError` MUST NOT 被调用

#### Scenario: 打断后继续对话无叠音
- **WHEN** AI 正在自动朗读消息 M1，用户通过开始录音或发送文字打断，随后 LLM 返回新回复并开始朗读 M2
- **THEN** M1 的音频已完全停止，用户仅听到 M2 的朗读，无两个声音叠加

### Requirement: 全局 stopAll 协调

对话页在发起新朗读或用户打断时，SHALL 依次调用已注册的全部引擎（`browser` 与 `iflytek`）的 `stop()`，而不仅停止当前激活引擎。此行为 MUST 与「引擎切换中断保护」一并保证全局单声源。

#### Scenario: 打断时双引擎均 stop
- **WHEN** 当前激活引擎为讯飞且浏览器引擎因兜底曾启动过播放，用户触发打断
- **THEN** `getEngine('browser').stop()` 与 `getEngine('iflytek').stop()` 均被调用

#### Scenario: 新 speak 前双引擎均 stop
- **WHEN** 对话页即将调用 `speakReply` 朗读新 AI 回复
- **THEN** 在 `engine.speak()` 之前，两引擎的 `stop()` 均已被调用（或由 speak 内部的 stop 链等效保证无残留播放）
