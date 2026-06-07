## Context

当前语音输入路径上有两条独立的转写流：

1. **浏览器路径**：`BrowserSpeechRecognition`（封装 `webkitSpeechRecognition`）连续识别，回调 `{ text, isFinal }`。`useVoiceInput` 维护 `pendingTranscriptRef`（已 final 累计）+ `lastInterimRef`（当前 interim），预览字符串由 `getCombinedTranscript()` 拼接 `${pending} ${interim}`。
2. **服务端路径**：录音结束后用 PCM → WAV → `POST /asr` → SiliconFlow SenseVoice，文本经 `cleanSenseVoiceText` 剥控制标记/emoji，作为最终权威转写覆盖浏览器结果。

两条路径都不做标点 / 大写规范化，于是用户消息出现 `holidays this is my first time to speak` 这种纯小写、无句末标点的形式。

预览侧的"非增量观感"实际上来自浏览器引擎本身：interim 段落是引擎的整段假设，下一个 interim 是新假设的整段，UI 直接把 `pending + interim` 全部重渲——hash diff 落在前几个词上，看起来就是"`holidays` 突然变成 `holidays this`"的整段刷新。要做到"逐词追加"的视觉效果，必须在 hook 层把 interim 字符串切成词，按"已显示前缀 + 新词"的方式重组渲染，避免引擎修订过程影响已稳定显示的前缀。

## Goals / Non-Goals

**Goals**

- 服务端 ASR 路径返回的文本带句末标点 + 句首大写。
- 浏览器 ASR 路径在未启用服务端兜底时，最终 `onTranscript` 文本同样带标点 + 大写。
- 录音预览以"逐词追加"的视觉呈现增长，不再因 interim 修订发生整段闪烁。
- 不破坏现有 `cleanSenseVoiceText` 控制标记 / emoji 清洗职责。
- 不影响 VAD 静默自动停止与 PCM 发音评测链路。

**Non-Goals**

- 不为 LLM 回复做后处理标点（已是模型自带）。
- 不引入服务端流式增量推送（仍是录音结束后一次性转写）。
- 不替换 `BrowserSpeechRecognition` 的底层引擎；仅在 hook 层重组渲染。
- 不动 `Conversation.tsx` 的对外消息契约（`onTranscript(text)` 仍传一个完整字符串）。

## Decisions

### 1. 标点 / 大写规范化集中到一个共享函数

新增 `shared/transcript-normalize.ts`（或放在 `web/src/lib/transcript-normalize.ts` + 同名 server 副本，按现有 monorepo 划分选其一），导出：

```ts
export function normalizeTranscript(raw: string): string;
```

**算法**（纯函数，无副作用）：

1. trim + 折叠多空白。
2. 若整段无任何句末标点（`.` `?` `!`），按规则 4 整体处理；否则按已有标点切句。
3. 对每个句子：
   - 首字符大写（保留缩写 `it's`、所有格 `john's` 不动——只大写第一个字母，不碰其他字母）。
   - 句末若无标点：以疑问词起句（`who/what/where/when/why/how/which/can/could/do/does/did/is/are/am/will/would/should`，大小写无关）补 `?`，否则补 `.`。
4. 句子之间用单空格连接。
5. 已有的 `,` `;` `:` 中间标点保留原位，不重新断句。

**为什么共享**：服务端路由（`asr.routes.ts`）与前端 hook（`useVoiceInput.ts`）都要调用同一份算法，方便测试与一致性。Monorepo 现状下 `shared/` 已被前后端 import，**放 `shared/transcript-normalize.ts`** 最干净；`shared/contracts.ts` 已是公共类型，相同位置最自然。

### 2. 服务端 ASR：上游参数优先，本地兜底

修改 `server/src/http/asr.routes.ts` 的 `siliconflowTranscriber()`：

- 在 multipart form 中追加 SiliconFlow / SenseVoice 文档支持的标点参数（`response_format=verbose_json` 或 `enable_punctuation=true`，按上游真实参数为准；若上游不接受则忽略，仅靠本地兜底）。
- `cleanSenseVoiceText` 不变，**新增** `normalizeTranscript` 在其后调用：

```ts
return normalizeTranscript(cleanSenseVoiceText(data.text ?? ''));
```

**为什么不只本地处理**：上游若已带标点（含逗号/分号），上游标点比启发式规则更准；本地仅做兜底，避免重复加点。

### 3. 浏览器 ASR：在 final chunk 拼接处归一化

修改 `useVoiceInput.ts` 的 final 分支：

```ts
if (result.isFinal) {
  const chunk = result.text.trim();
  if (chunk) {
    pendingTranscriptRef.current = pendingTranscriptRef.current
      ? `${pendingTranscriptRef.current} ${chunk}`
      : chunk;
  }
  ...
}
```

`finishRecording` 内拿到 `browserText` 后，若不走服务端 ASR（`useServerAsr === false` 或服务端失败回退），对 `browserText` 调一次 `normalizeTranscript`。服务端走通时，`text` 已在路由内规范化，不再二次处理。

### 4. 真·增量预览：按词 diff 重组

`useVoiceInput` 内部状态结构变更：

```ts
// 旧
pendingTranscriptRef = '...';   // 已 final 累计
lastInterimRef = '...';          // 当前整段 interim

// 新
committedWordsRef: string[] = [];  // 已 final 词序列（含跨 final 累计）
interimWordsRef:   string[] = [];  // 当前 interim 切词
```

预览字符串：

```ts
function renderPreview() {
  return [...committedWordsRef.current, ...interimWordsRef.current].join(' ');
}
```

interim 更新时：

- `nextInterimWords = result.text.trim().split(/\s+/)`
- 直接 `interimWordsRef.current = nextInterimWords`（即使整段被引擎改写，也只影响 interim 区段）
- React 列表渲染按 word 索引 key 比对（用 `<span>` 数组而不是单个字符串），React 会保留前缀稳定的 DOM 节点 → 视觉上无前缀闪烁。

`final` 到达时：

- `chunk.split(/\s+/)` 追加到 `committedWordsRef`。
- 清空 `interimWordsRef`。
- 同步 `pendingTranscriptRef = committedWordsRef.current.join(' ')` 兼容现有 `getCombinedTranscript` / 测试。

**为什么按 word 数组而非字符串**：React 仅 diff 整个 textNode 是不行的——必须把 word 拆成 sibling 节点，前缀 sibling key 不变才能保留 DOM 不重渲。新增的预览组件 `<TranscriptPreview committed={...} interim={...} />` 用 `committed.map((w, i) => <span key={`c-${i}`}>{w}</span>)` + `interim.map((w, i) => <span key={`i-${i}`}>{w}</span>)`。

> **替代方案**：CSS `transition` + 单 textNode。被否：textNode 文本变更时浏览器没有「保留前缀」的语义，仍会整体重排，做不到无闪烁。

### 5. 与 VAD 静默检测的协同

interim / final 任一更新时 `silenceDetectorRef.current?.resetSilenceTimer()` 不变，仍保证持续说话不被误停。`hasSpokenRef` 触发条件由"interim 非空 / final 有 chunk"扩展为"`committedWordsRef.length > 0 || interimWordsRef.length > 0`"。

### 6. 测试位置与组织

- **服务端**：`server/src/http/asr.routes.test.ts` 增加 `normalizeTranscript` 集成用例（输入 `holidays this is my first time to speak` → 输出 `Holidays this is my first time to speak.`）。
- **共享**：新增 `shared/transcript-normalize.test.ts` 覆盖纯函数：缺标点 / 已带标点 / 疑问词起句 / 缩写不被错断 / 中间逗号保留 / 多空白折叠。
- **前端 hook**：新增 `web/src/hooks/useVoiceInput.test.ts`（首次添加），用 vitest + jsdom + 模拟 `BrowserSpeechRecognition` 推送 interim/final 事件，断言：
  - 预览字符串按 `holidays` → `holidays this` → ... 顺序增长。
  - 多 final chunk 拼接为 `Hello everyone. How are you?`（关闭 `useServerAsr`）。
  - VAD 静默触发 `finishRecording` 走 `normalizeTranscript`。

## Risks / Trade-offs

- **SiliconFlow 上游参数差异**：不同模型版本对 `enable_punctuation` 支持不一致，可能不识别该字段——通过本地兜底吸收，影响仅是上游已带逗号时本地不会去主动补语义级停顿。
- **启发式规则误判**：`it's` / 所有格 / 数字（`I have 2 dogs`）等情况下，正则切句要小心。算法只对句末判断，不在词中切句，配合「只有遇到 `.?!` 才断句」保证不会把 `john's` 切错。
- **逐词渲染额外节点**：每词一个 `<span>` 在极长句子里增加 DOM 节点数，但语音识别一句话词数通常 < 30，可忽略。
- **测试新增 jsdom 依赖**：`web` 已用 vitest + jsdom（见 `web/vitest.config.ts`），不引入新 devDep。
- **回退路径**：服务端 ASR 失败时，浏览器结果会经本地 `normalizeTranscript`；但浏览器自己句末标点稀缺，启发式补 `.` 在偶发疑问句上可能错——可接受，已是兜底中的兜底。

## Migration Plan

无数据迁移。仅代码改动：

1. 新增 `shared/transcript-normalize.ts` + 测试。
2. 改 `server/src/http/asr.routes.ts` 调 `normalizeTranscript`。
3. 改 `web/src/hooks/useVoiceInput.ts` 内部状态 + 引入 `normalizeTranscript`。
4. `Conversation.tsx` 中渲染预览的位置改成消费 `committedWords` / `interimWords` 数组（或保留兼容字符串 + 子组件按 word 拆分，二选一，默认走子组件）。

部署：前后端同发布；服务端先发布兼容（即使前端旧版仍能正确接收带标点文本）。

## Open Questions

- 是否需要保留浏览器 final chunk 之间的"句号补全"开关？默认开启即可；若用户反馈过度断句，开 setting 关掉再说。
- 共享函数放 `shared/` 还是各自维护：暂定 `shared/`，理由见 §1。
