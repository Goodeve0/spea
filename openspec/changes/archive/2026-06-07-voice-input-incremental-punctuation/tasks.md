# Tasks · voice-input-incremental-punctuation

> 直接基于 `design.md`。每个任务对应一处文件改动，按 `Setup → 共享 → 服务端 → 前端 → 测试 → 验收` 顺序推进，可勾选。

## 1. Setup

- [x] 1.1 阅读 `design.md` §1–§6，确认 `normalizeTranscript` 算法、状态结构改造、测试覆盖矩阵无歧义。
- [x] 1.2 在 `web/` 与 `server/` 分别确认无未提交改动，准备提交粒度按层切：shared / server / web 各一个 commit。

## 2. 共享：normalizeTranscript

- [x] 2.1 新建 `shared/transcript-normalize.ts`，导出 `normalizeTranscript(raw: string): string`。
  - 实现：trim → 折叠多空白 → 句子切分（按 `.?!`）→ 每句首字符大写 → 句末无标点时按疑问词起句补 `?` 否则补 `.` → 单空格连接。
  - 疑问词集合常量：`who/what/where/when/why/how/which/can/could/do/does/did/is/are/am/will/would/should`（大小写无关）。
  - 不修改词中其他字符（保持 `it's` / `John's`）。
- [x] 2.2 在 `shared/contracts.ts` 末尾追加 `export { normalizeTranscript } from './transcript-normalize';`，让 `@speak-coach/shared` 直接暴露该函数；不引入新入口。
- [x] 2.3 新建 `shared/transcript-normalize.test.ts`，覆盖：
  - 空串 / 全空白 → `''`
  - `holidays this is my first time to speak` → `Holidays this is my first time to speak.`
  - `where are you from` → `Where are you from?`
  - `it's been a while` → `It's been a while.`
  - `well, that's interesting` → `Well, that's interesting.`
  - `Holidays, this is my first time to speak.` → 不动（已合规）
  - `hello   everyone` → `Hello everyone.`（多空白折叠）
- [x] 2.4 `npm run --workspace shared test` 全绿。

## 3. 服务端：ASR 路由接入归一化

- [x] 3.1 修改 `server/src/http/asr.routes.ts`：
  - `siliconflowTranscriber()` 内 form 追加上游标点参数（按 SiliconFlow 文档落字段；该字段被忽略不影响功能）。
  - 在 `cleanSenseVoiceText(...)` 之后串入 `normalizeTranscript(...)`，作为 `Transcriber` 的最终返回。
  - **顺序固定**：cleanSenseVoiceText → normalizeTranscript，不得交换。
- [x] 3.2 在 `server/src/http/asr.routes.test.ts` 增加用例：
  - 上游返回 `holidays this is my first time to speak` → 响应 `text` 为 `Holidays this is my first time to speak.`
  - 上游返回 `<|en|><|NEUTRAL|>holidays this is my first time to speak😊` → 响应 `text` 为 `Holidays this is my first time to speak.`
  - 上游返回 `where are you from` → 响应 `text` 为 `Where are you from?`
- [x] 3.3 `npm run --workspace server test -- asr.routes` 全绿。

## 4. 前端：useVoiceInput 增量预览改造

- [x] 4.1 修改 `web/src/hooks/useVoiceInput.ts` 的内部状态：
  - 新增 `committedWordsRef: { current: string[] }` 与 `interimWordsRef: { current: string[] }`。
  - 移除（或保留作为派生）`pendingTranscriptRef` / `lastInterimRef`：保留 `pendingTranscriptRef` 作为字符串派生值供 `getCombinedTranscript` 测试兼容；`lastInterimRef` 删除。
- [x] 4.2 改写 `recognition.onResult` 回调：
  - `result.isFinal === true`：把 `result.text.trim().split(/\s+/)` 追加到 `committedWordsRef.current`，清空 `interimWordsRef.current`，同步 `pendingTranscriptRef.current = committedWordsRef.current.join(' ')`。
  - `result.isFinal === false`：`interimWordsRef.current = result.text.trim().split(/\s+/)`（空串则置 `[]`）。
  - 任一分支结束都 `silenceDetectorRef.current?.resetSilenceTimer()` + `syncPreview()`。
- [x] 4.3 改写 `getCombinedTranscript` / `syncPreview`：
  - `recordingPreview` 改为新增 state `previewWords: { committed: string[]; interim: string[] }`，并保留 `recordingPreview: string`（`[...committed, ...interim].join(' ')`）以兼容现有外部消费。
  - 在 `VoiceInputHandle` 接口里新增 `previewWords` 字段，类型 `{ committed: string[]; interim: string[] }`。
- [x] 4.4 改写 `finishRecording`：
  - 取 `browserText = [...committedWordsRef.current, ...interimWordsRef.current].join(' ')`。
  - **服务端 ASR 走通**：使用服务端返回（已规范化）。
  - **服务端 ASR 失败 / 未启用**：对 `browserText` 调一次 `normalizeTranscript`。
  - 复位 `committedWordsRef`、`interimWordsRef`、`pendingTranscriptRef`、`hasSpokenRef`、`previewWords`。
- [x] 4.5 在 `useVoiceInput` 中 `import { normalizeTranscript } from '@speak-coach/shared'`，沿用 §2.2 的导出方式。

## 5. 前端：Conversation 渲染逐词节点

- [x] 5.1 在 `web/src/pages/Conversation.tsx` 找到当前消费 `recordingPreview` 的节点，改为渲染 `previewWords`：
  - `committedWords.map((w, i) => <span key={`c-${i}`} className="...committed...">{w} </span>)`
  - `interimWords.map((w, i) => <span key={`i-${i}`} className="...interim...">{w} </span>)`
  - 用 React key 稳定前缀 → DOM 节点不被销毁重建。
- [x] 5.2 保持原有"录音中省略号动画"触发条件：`previewWords.interim.length > 0`。
- [x] 5.3 视觉：committed 与 interim 字色一致或 interim 浅一档（按现有样式系统选最贴近的 token；不引入新色卡）。

## 6. 前端测试

- [x] 6.1 新建 `web/src/hooks/useVoiceInput.test.ts`（不存在则创建），用 vitest + jsdom：
  - mock `BrowserSpeechRecognition`，可手动触发 `onResult` 事件。
  - 用例 A：连续推送 interim `holidays`、`holidays this`、`holidays this is`、`holidays this is my first time to speak` → 断言每步 `previewWords.interim` 切词正确，`recordingPreview` 字符串按预期增长。
  - 用例 B：推送 final `hello everyone` 后再 final `how are you`，关闭 `useServerAsr`，触发 `finishRecording` → 断言 `onTranscript` 收到 `Hello everyone how are you.`（浏览器 final 块之间无标点信号，兜底按整段补一次句末点）。
  - 用例 C：interim → final → interim 循环，断言 final 后 `interimWordsRef` 清空，`committedWordsRef` 累积正确。
- [x] 6.2 `npm run --workspace web test -- useVoiceInput` 全绿。

## 7. 集成验收

> 7.x 需要在浏览器中实测，留待用户/PR 评审阶段执行；本会话仅提供改动并通过自动化测试。

- [ ] 7.1 本地启动：`npm run dev`，进入 Team Meeting 场景。
  - 实测说出 `holidays this is my first time to speak`：观察预览字符串逐词增长，无前缀闪烁。
  - 静默后消息气泡显示 `Holidays this is my first time to speak.`（带句首大写 + 句末点）。
- [ ] 7.2 切到一句疑问句（"where are you from"）→ 消息气泡显示 `Where are you from?`。
- [ ] 7.3 关闭服务端 ASR（临时设 `useServerAsr={false}` 或断网）→ 浏览器路径下消息仍带标点 + 大写。
- [ ] 7.4 PCM 发音评测继续工作（Report 页雷达图有数据）。
- [ ] 7.5 VAD 静默自动停止行为不变（持续说话不被截断、停顿后自动停）。

## 8. 回归 & 收尾

- [x] 8.1 改动相关检查全绿：`shared` test 13/13、`server asr.routes` 7/7、`web` 全套 92/92、`npx tsc --noEmit`（web）无错、`npm run --workspace web build` 通过。仓库内既有 buddy/auth Prisma 测试在无 DATABASE_URL 环境本就 FAIL（与本变更无关）。
- [x] 8.2 自检：
  - `cleanSenseVoiceText` 仍先于 `normalizeTranscript` 执行（`asr.routes.ts:45`）。
  - 没有引入新依赖 / 新环境变量。
  - `shared/contracts.ts` 末尾仅追加 1 行 re-export，未改 contract 体积。
- [ ] 8.3 提交按 §1.2 切层；PR 描述附「问题截图」+「修复后录屏」+「`Holidays this is my first time to speak.` 实测样例」。
- [x] 8.4 归档：`/opsx:archive voice-input-incremental-punctuation`。
