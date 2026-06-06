## Context

进入 `Conversation` 页时，`Conversation.tsx` 在挂载副作用里直接调用 `speakReply(greetingId, greeting, ...)` 朗读 AI 开场白；同时把 `readingTurnId` 设为开场白 id、`isAiSpeaking` 设为 `true`，UI 渲染出"正在朗读…"。

**现象（修正）：开场白朗读时有时无 —— 间歇性失败。**

不是浏览器 Autoplay Policy 完全锁死（如果是锁死会 100% 无声）。结合 Chrome/Edge/Safari 在 `speechSynthesis` 上的常见行为，间歇性失败的根因通常是以下几种竞争与挂起态的组合：

1. **`speechSynthesis.paused` 残留**：浏览器在长时间无交互或前一页面对 TTS 队列做了 `cancel()` 后，整个 synthesis 引擎可能处于 `paused` 态；新 `speak()` 入队但不真的发声，且不会触发 `onstart/onend/onerror`。
2. **队列残留 utterance**：跨路由 / 刷新时，前一个 utterance 没完整结束就被 cancel，引擎短时间内对新 utterance 静默吞掉。
3. **`voiceschanged` 异步**：首次 `getVoices()` 返回空、还没拿到英文音色就 speak，部分平台对"无 voice utterance"的处理不稳定。
4. **路由跳转手势消耗**：从场景页点击进对话页携带一次用户手势，能成功播一次；F5 刷新或后退/前进进入则可能丢失手势上下文，被静默拦截但**不**抛 onerror。

UI 此时已经进入"正在朗读…"，但音频未发声 —— 用户感知就是"显示朗读却没声"。

相关代码：
- `web/src/pages/Conversation.tsx:191-202`：mount 时直接 `speakReply()` 自动朗读开场白
- `web/src/audio/speech-synthesis.ts`：`speak()` 仅依赖 `onstart/onend/onerror`，任一被静默吞掉就卡死
- `web/src/audio/tts-engine.ts`：`TtsSpeakOptions` 已（本次扩展）新增 `onStart`，并定义 `BROWSER_START_TIMEOUT_MS=1500` / `IFLYTEK_START_TIMEOUT_MS=3000`

iflytek 引擎走 WebSocket，受本 bug 影响相对较小（自带 `onError`），但同样应对"WS 已连但首帧未到"的边界做超时兜底。

## Goals / Non-Goals

**Goals:**
- **保留**进入页面自动朗读开场白的 UX（其他逻辑不变）。
- **可靠发声**：浏览器引擎在调用 `speak()` 后，能克服 `paused` 态、队列残留、voices 异步等可恢复因素，**首选自动重试**而不是直接放弃。
- **UI 严格对齐真发声**：`readingTurnId` 在"音频真的开始播放"时（`onStart`）才被点亮，避免出现"显示朗读但还在重试"的中间假象。
- 启动重试全部失败时，**兜底**触发 `onError + onEnd`，让上层 UI 复位（按钮回空闲态、`isAiSpeaking=false`），不再卡死。
- 不引入显式"播放"按钮、不取消自动朗读，最大限度保持现状 UX。

**Non-Goals:**
- 不改后端 / WS 协议。
- 不改用户已说话之后的多轮 AI 自动朗读流程（彼时已有用户手势，且复用同一 speak 路径已自然受益）。
- 不引入"全局解锁音频上下文"的复杂状态机；`paused`/`resume` 只在 `speak()` 内部按需做。
- 不修改 voices 加载策略本身（仍用现有 `voiceschanged` 缓存）。
- 不处理用户切到后台导致的浏览器自身播控（属另外问题）。

## Decisions

### D1 — 保留 mount 时自动朗读，专注让声音可靠（替换原 D1）

**决定**：`Conversation.tsx` 进入页面时**继续**调用 `speakReply(greetingId, greeting, ...)`，**不**取消自动朗读、**不**新增显式播放按钮。修复焦点全部下沉到 `BrowserSpeechSynthesisEngine.speak()`：让它对各种"挂起 / 静默吞掉"场景做内部恢复，对调用方表现为"要么真的播了，要么明确失败回调"。

**为何选 X 而非 Y：**
- 备选 A（取消自动朗读 + 显式按钮）：✗ 改变现有 UX，用户多一步操作；从问题描述"其他逻辑不变"看不符合产品意图。
- 备选 B（每次进入页面前请求一次解锁声音的弹窗）：✗ 体验劣化、过度工程。
- 选定方案 ✓：把可靠性问题留在引擎层用"重试 + 超时兜底"解决，调用方维持现有时序。

### D2 — `speak()` 内部"清理 + 重试 + 超时"三段式（核心修复）

**决定**：`BrowserSpeechSynthesisEngine.speak()` 改造为如下流程：

1. **进入前清理**：进入 `speak()` 时除原有 `this.stop()`（其中已 `cancel()`）外，调用一次 `speechSynthesis.resume()` 清 `paused` 残留态。`resume()` 即使在空闲状态调用也安全。
2. **首次同步执行 `speak()`**：**不**用 `setTimeout(0)` 推迟首次入队。Web Speech 的 user-gesture token 必须在调用栈同任务内消费，跨 tick 会被浏览器视为"无手势"再次静默拦截（点击播放按钮也无声）。所以首次 `tryStart(0)` 直接同步调用。
3. **启动检测 + 自动重试**：`speak(utterance)` 后启动启动计时器（`BROWSER_START_TIMEOUT_MS = 1500ms`）。若到时仍未触发 `utterance.onstart`：
   - 累计重试次数 < `MAX_START_RETRIES`（设为 2 次）→ `cancel() + resume()` 后**重建一份新的 SpeechSynthesisUtterance**（旧 utterance 重用会被 Chrome 拒绝），用 `setTimeout(0)` 让浏览器消化前一次 cancel 后再 speak。重试已脱离首次手势上下文，异步入队是安全的。
   - 累计重试次数 ≥ `MAX_START_RETRIES` → 触发 `onError(new Error('SpeechSynthesis start timeout'))` + `onEnd()`，让上层 UI 复位。
4. **沿用代际机制**：`stop()` 或新一轮外部 `speak()` 仍递增 `generation`，所有重试相关 setTimeout 与新建 utterance 必须以"创建时记录的 gen"守卫，防止打断后旧重试链继续触发。
5. **`onStart` 严格回调**：`utterance.onstart` 触发且代际匹配时清掉启动计时器、调用 `opts.onStart?.()`。重试期间 `onStart` 不会被调用 —— 这正是上层期望的"对齐真发声"。

**总等待预算**：最多 `1500ms × 3 次 = 4.5s` 后给出失败结论。实际正常发声平均 < 300ms，重试只在异常路径触发，不影响快路径。

**为何 1500ms / 2 次**：
- 1500ms：覆盖正常启动抖动 + 给 Chrome `cancel→speak` quirk 留出 buffer；阈值短到用户感知不到等待。
- 2 次重试：经验上"挂起队列"通常 1 次清理 + 1 次重 speak 就能恢复；3 次也就是兜底。再多没收益。

**踩过的坑（修订记录）**：早期版本在 `speak()` 入口就用 `setTimeout(0)` 推迟首次入队，本意是规避 "cancel→speak" Chrome quirk。但实测点击朗读按钮也无声 —— 因为 Web Speech 的 user-gesture token 跨 tick 失效，浏览器把异步入队的 utterance 视为"无手势触发"直接静默拦截。修正方案：首次同步入队保住手势，仅重试用异步。

### D3 — `voices` 加载兜底

**决定**：`speak()` 时若 `pickEnglishVoice()` 返回 `undefined` 且 `cachedVoices.length === 0`，**不**给 utterance 设 `voice`（沿用现有逻辑），不阻塞 speak。`voiceschanged` 监听已存在，下次 speak 自然能拿到。

**为何不在这里阻塞等 voices**：等 voices 是另一类不确定异步，会让首次 speak 体验更差；且无 voice 时大多数浏览器会回退到默认语音，仍可发声。

### D4 — `TtsSpeakOptions` `onStart` 回调（保留，配合 D2 使用）

**决定**：维持已实现的 `onStart` 字段。上层 `Conversation.speakReply / handleReadAloud` **不需要**改造为依赖 `onStart` 设置 `readingTurnId`：mount 时调用方已经知道要朗读哪条 turn，先把 UI 状态设为"加载朗读"（沿用现状）；`onError`（含启动重试全部失败）必须复位 UI。

> 修订说明：原 D4 主张"上层把 setReadingTurnId 移到 onStart 里"。本轮调整后**不**移动 —— 因为：
> - "其他逻辑不变"原则要求保留 mount 立刻显示"正在朗读"的 UX；
> - D2 的引擎内重试在 4.5s 内总能给出最终结论；
> - `onError` 路径已能复位 UI，闭环成立。
>
> `onStart` 仍然保留作为**测试与诊断手段**：单测断言重试前不触发 `onStart`、最终成功才触发；引擎实现内部用其作为"清理启动计时器"的信号。

### D5 — `onError` 始终复位 UI 状态（保留）

`Conversation.speakReply` / `handleReadAloud` 的 `onError` 必须清掉 `readingTurnId`、释放 `readingBusyRef`、`setAiSpeaking(false)`。现有代码已基本满足，本次修复需确认"启动超时"也走该路径。

### D6 — 讯飞引擎与浏览器引擎对齐

讯飞引擎走 WS：
- 已新增 `IFLYTEK_START_TIMEOUT_MS = 3000ms` 启动兜底（首帧未到 → onError + onEnd）。
- 不引入"重试讯飞 WS"；讯飞失败已有"切回浏览器引擎兜底"路径（`Conversation.speakReply.onError`），让浏览器引擎的内部重试天然吸收掉这一波。
- `onStart` 在首帧入队时调用（已实现）。

## Risks / Trade-offs

- **风险**：极端环境下 4.5s 内仍无法发声，用户看到 4.5s 的"正在朗读…"假状态。
  → 缓解：4.5s 后 onError 复位 UI，按钮回空闲态。后续可加一个轻量 toast 提示"语音播放暂不可用，可点击朗读按钮重试"。

- **风险**：重试期间用户已主动点麦克风/发文字打断 → 旧重试链触发新 utterance。
  → 缓解：所有重试逻辑用 `gen === this.generation` 守卫；`stop()` 已 `++generation`，自动作废所有挂起重试。

- **风险**：`speechSynthesis.resume()` 在某些不支持的环境下抛异常。
  → 缓解：用 try/catch 包住，失败仅 console.warn 不阻塞主流程。

- **风险**：`requestAnimationFrame` 在页面不可见时会暂停。
  → 缓解：使用 `setTimeout(0)` 而非 `requestAnimationFrame`，对页面可见性不敏感。

- **权衡**：浏览器引擎从"一次 speak"变成"最多三次 speak"。
  → 正常路径不变；异常路径多花最多 4.5s 但能从大部分挂起态恢复，用户少一次"显示朗读但没声"的卡死，明显划算。

## Migration Plan

- 纯前端修改，无数据迁移。
- 部署后旧版 cache 的页面在用户刷新后获得新行为。
- 进行中的对话不受影响。
- 回滚：还原 `BrowserSpeechSynthesisEngine.speak()` 中的"清理 + 重试"分支即可（保留 `onStart` 字段与 startTimer 兜底也无害）。

## Open Questions

- 是否需要在 4.5s 后给用户一个 toast 提示？默认本期不加，先观察日志（`[BrowserSpeechSynthesisEngine.speak] start retry`/`start timeout`）出现频次再决定。
- 讯飞引擎是否也加 1 次重试？目前讯飞 WS 失败已切回浏览器引擎，等同于 1 次重试，本期不再加。
