## Context

**当前状态**

对话页 TTS 播放由三条路径触发，均经 `Conversation.tsx` 编排：

| 入口 | 函数 | 触发时机 |
|------|------|----------|
| AI 自动朗读 | `speakReply(turnId, text, onEnd)` | LLM 回复入库后 |
| 手动跟读 | `handleReadAloud(turnId, text)` | 点击消息下方朗读按钮 |
| 讯飞失败兜底 | `speakReply` 内 `onError` → `browser.speak` | 讯飞 WS/发音人错误 |

打断路径：`handleStartRecording()`、`handleUserMessage()` 均调用 `stopSpeaking()` → `stopAudio()`（两引擎 `stop()`）+ 清 `isAiSpeaking` / `readingTurnId`。

**已知缺陷（根因分析）**

1. **讯飞 `IflytekTtsEngine.stop()` 不彻底**：仅 `audioContext.suspend()` 并清空 `active`，已 `source.start()` 的 `AudioBufferSourceNode` 未被追踪/停止；新 `speak()` 会 `resume()` 同一 context，旧帧与新帧叠加发声。
2. **浏览器 `BrowserSpeechSynthesisEngine.stop()` 回调泄漏**：`speechSynthesis.cancel()` 后，部分浏览器仍触发旧 utterance 的 `onend`/`onerror`，可能再次执行 `onEnd` 或触发 `speakReply` 兜底链。
3. **无全局播放代际（generation）**：`stop()` 与迟到的 WS 帧、`setTimeout(scheduleEnd)`、utterance 事件之间缺少统一失效机制，旧会话资源未与 `requestId` 绑定到可取消的音频节点。
4. **讯飞兜底路径**：`onError` 中在未确认讯飞已静音的情况下启动浏览器引擎，可能与残留讯飞帧重叠。

现有 `tts-engine` 规格「引擎切换中断保护」只约束设置面板切引擎，未覆盖「同引擎内打断再播」与「打断后继续对话」。

**约束**

- 不修改 `shared/contracts.ts` 或后端 WS 消息类型。
- 不引入新 npm 依赖。
- 保持 `ITtsEngine` 对外签名不变（`speak` / `stop` / `isAvailable` / `dispose`）。

## Goals / Non-Goals

**Goals:**

1. 任意时刻最多一个 TTS 播放会话可听（含打断、跟读切换、讯飞→浏览器兜底）。
2. 用户打断（开始录音 / 发送文字）后，旧音频立即停止，旧会话 `onEnd` 不再驱动 UI 或触发新播放。
3. 新 `speak()` 开始前，两引擎均处于干净状态；跟读按钮与 `readingTurnId` / `isAiSpeaking` 与真实播放一致。
4. 关键路径有单元测试（代际失效、stop 后无新帧入队、cancel 后无 stale 回调）。

**Non-Goals:**

- 不实现服务端 `tts.cancel` WS 消息（后端可能继续推旧 request 的帧，前端忽略即可）。
- 不重构 TTS 为单例播放管理类（除非实现中发现必要；优先引擎内修复）。
- 不修改 LLM 流式生成逻辑。
- 不在设置面板新增「打断行为」配置项。

## Decisions

### 决策 1：播放代际 token（Playback Generation）

每个引擎内部维护 `private generation: number`（初始 0）。每次 `speak()` 开头 `++generation` 并记录 `const gen = generation`；`stop()` 也 `++generation` 使进行中的 speak 失效。

所有异步出口（`onEnd`、`onError`、`enqueuePcmFrame`、`scheduleEnd` 的 setTimeout、utterance 事件）执行前检查 `gen === this.generation`，不匹配则静默返回。

**选择**：引擎内代际 token。  
**替代方案 A**：全局 `tts-engine.ts` 统一 generation —— 两引擎独立生命周期，全局 token 无法单独失效已挂起的 browser utterance 与 iflytek buffer。  
**替代方案 B**：仅依赖 `requestId` —— 浏览器引擎无 requestId，且 iflytek 已调度节点与 requestId 解耦。

### 决策 2：讯飞 stop — 关闭并重建 AudioContext

`stop()` 时：

1. `++generation`（作废进行中的 speak / 回调）
2. 对所有已追踪的 `AudioBufferSourceNode` 调用 `stop()`（若仍 connected）
3. `audioContext.close()` 并置 `null`（不再仅用 `suspend`）
4. 清除 `active` 与 pending `scheduleEnd` timer

新 `speak()` 通过 `ensureAudioContext()` 创建全新 context，`nextStartAt` 从 0 计时。

**选择**：close + 重建 context，并追踪 source 节点。  
**替代方案**：仅 suspend —— 已证实 resume 后旧节点继续播放，不足。

### 决策 3：浏览器 stop — cancel + 代际失效 + 清空 utterance 引用

`stop()` 时 `++generation`、`speechSynthesis.cancel()`、`this.utterance = null`。  
utterance 的 `onend` / `onerror` 内先比对 `gen === this.generation` 再调用 opts 回调。

**选择**：与决策 1 一致，最小改动。  
**备注**：`cancel` 触发的 `interrupted` 错误事件应被代际检查吞掉，不向上冒泡为 `onError`（除非 gen 仍匹配且为真实错误）。

### 决策 4：Conversation 层统一「先停后播」

提取或强化现有分层：

```
stopAllTts()     → getEngine('browser')?.stop(); getEngine('iflytek')?.stop();
stopSpeaking()   → stopAllTts() + setAiSpeaking(false) + setReadingTurnId(null)
beginSpeak(...)  → stopAllTts(); 然后 engine.speak(...)
```

`speakReply` 与 `handleReadAloud` 在调用 `engine.speak` 前均经 `stopAllTts()`（`speak` 内部也会 stop，双保险成本低）。

讯飞 `onError` 兜底：先 `stopAllTts()` 再 `browser.speak`，且兜底 speak 使用新代际（browser.speak 内部自增）。

**选择**：Conversation 显式 `stopAllTts` + 引擎内代际。  
**为什么**：UI 状态复位与引擎静音必须在同一同步 tick 完成，避免 React 批处理导致按钮仍亮而音频已停的中间态过长。

### 决策 5：WS 迟到帧 — 保持 requestId 过滤，不增协议

`handleMessage` 在 `!this.active || payload.requestId !== this.active.requestId` 时丢弃；`stop()` 清空 `active` 后自然忽略。代际检查作为第二道防线，防止 `active` 竞态窗口内入队。

**选择**：前端防御，不增 `tts.cancel`。  
**权衡**：后端可能浪费带宽推完旧 request；可接受，后续优化可另开变更。

### 决策 6：测试策略

| 文件 | 覆盖点 |
|------|--------|
| `iflytek-tts-client.test.ts`（新建或扩展） | mock AudioContext；stop 后 enqueue 不执行；generation 变更后 onEnd 不触发 |
| `speech-synthesis.test.ts`（新建或扩展） | stop 后 onend 不触发 opts.onEnd；连续 speak 仅最后一次 onEnd |
| 可选 Conversation 集成测 | mock engine，`stopSpeaking` 后 `speakReply` 仅一次活跃播放 |

测试使用 Vitest + mock，不依赖真实 WS / 浏览器 speech API。

## Risks / Trade-offs

- **[Risk] 频繁 close AudioContext 的创建开销** → 对话场景 TTS 次数有限，可接受；若 profiling 有问题可改为追踪 nodes 而不 close context。
- **[Risk] generation 溢出** → JS number 安全范围内可忽略；若需严谨可在 `++generation` 达上限时归零并 stop 全部。
- **[Risk] 双 stop（Conversation + engine.speak 内 stop）** → 有意为之，确保打断路径与 speak 路径一致；代际自增两次仅使中间态更短，无副作用。
- **[Risk] 讯飞兜底时用户已打断** → `onError` 回调内检查：若 `readingTurnId !== turnId` 或 `!isAiSpeaking`（视调用场景）则不再 browser.speak；或在 Conversation 用 ref 记录「用户已打断」标志，打断时递增 `interruptEpoch`，speakReply 闭包比对。

## Migration Plan

1. 修改 `IflytekTtsEngine`：generation、source 追踪、stop 关闭 context、清除 scheduleEnd timer。
2. 修改 `BrowserSpeechSynthesisEngine`：generation、stale 事件忽略。
3. 修改 `Conversation.tsx`：`stopAllTts` 提取；`speakReply` 兜底加打断守卫；确认 `handleStartRecording` / `handleUserMessage` 均走 `stopSpeaking`。
4. 补充单元测试，`npm test` 全绿。
5. 手动验证：AI 朗读中点麦克风说话 → 新回复仅一声；跟读中打断 → 无叠音；讯飞引擎下重复打断 3 次。

**回滚**：还原上述 3 个前端文件及测试即可，无数据迁移。

## Open Questions

1. **是否需要在 `tts-engine.ts` 导出 `stopAllEngines()` 供其他页面复用？** —— 当前仅 Conversation 使用，v1 可留在页面内；若报告页未来加 TTS 再提取。
2. **打断守卫用 session 状态还是 Conversation ref？** —— 倾向 `interruptEpochRef`（打断时递增），避免 speakReply 异步回调读到 stale Zustand 状态；实现 tasks 阶段确定。
