## ADDED Requirements

### Requirement: 进入对话页自动朗读必须可靠发声

进入对话页时，系统继续按现有 UX 自动朗读 AI 开场白。`BrowserSpeechSynthesisEngine.speak()` MUST 在内部对常见的"挂起 / 静默吞掉"场景做有限重试与超时兜底，使**正常环境下用户能听到开场白**、**异常环境下也不会出现"显示正在朗读但完全没声音且不复位"的卡死**。

启动失败终态必须导致：UI 的 `readingTurnId` 复位为 `null`，对应消息的朗读按钮恢复空闲态（🔈 朗读），`isAiSpeaking` 设为 `false`。

#### Scenario: 进入页面正常发声
- **WHEN** 用户进入对话页，浏览器与音频环境正常
- **THEN** 在 1.5 秒内开始朗读开场白文字，对应朗读按钮显示为激活态（🔊 正在朗读…）

#### Scenario: 浏览器初次静默吞掉 speak 时由重试恢复
- **WHEN** 用户进入对话页，第一次 `speak()` 调用后 1500ms 内未触发 `onstart`
- **THEN** 引擎自动 `cancel() + resume()` 后重建 utterance 重新 `speak()`，不向上层抛 `onError`；若重试后开始发声，用户最终听到开场白

#### Scenario: 启动重试全部失败时 UI 自动复位
- **WHEN** `speak()` 经过最多 2 次重试（合计最长约 4.5 秒）仍未发声
- **THEN** 引擎调用 `onError(new Error('SpeechSynthesis start timeout'))` 与 `onEnd()`；上层 `Conversation.speakReply` 的 `onError` 路径将 `readingTurnId` 置为 `null`、按钮恢复空闲态、`isAiSpeaking` 置为 `false`，UI 不再卡死

#### Scenario: 用户在重试期间打断时不被旧重试链覆盖
- **WHEN** 引擎正处于启动重试等待中（尚未发声），用户点击麦克风开始录音或发送文字
- **THEN** `stop()` 递增播放代际，所有挂起的重试 setTimeout 与未发出的新 utterance MUST 通过代际守卫被静默丢弃，不会出现"打断后旧开场白突然开始朗读"
