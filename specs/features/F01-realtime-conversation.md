# F01 · 实时语音对话引擎 · Feature Spec

> 系统的核心功能：用户用语音和扮演角色的 AI 进行低延迟自然对话。
> 实现前必读：`00-AI-HARNESS.md` + `02-SDD.md` 第 4/5/6 节。

---

## 1. 概述
- **关联需求**：`01-PRD.md` US-02 实时语音对话
- **关联任务**：`04-TASKS.md` T-12（dialog.service）、T-21（串联）、T-33（对话页）
- **一句话目标**：用户说完话后 ≤1.5s 内，听到 AI 以场景角色身份做出的自然语音回复，并看到流式字幕。

## 2. 范围（Scope）

**本功能要做：**
- AI 按 `Scenario.rolePrompt` 扮演角色，生成开场白。
- 接收用户文本（来自 ASR），结合多轮上下文流式生成回复。
- 回复按句切分，第一句生成完即送 TTS，实现首包低延迟。
- 维护单次 session 的对话上下文。

**本功能不做（明确排除）：**
- 不做 ASR 本身（属 `asr.service` / T-14）。
- 不做 TTS 本身（属 `tts.service` / T-15）。
- 不做纠错（属 F02 / correction.service，异步旁路）。
- 不做发音评测。
- 不做跨 session 的长期记忆。

## 3. 接口契约（Contract）

> 细化 `02-SDD.md` 第 5 节 `IDialogService`。

```ts
interface IDialogService {
  /** 生成场景开场白 */
  greet(scenario: Scenario): Promise<string>;

  /**
   * 流式生成 AI 回复
   * @param sessionId 用于检索上下文
   * @param userText  本轮用户发言（ASR 最终结果）
   * @param onDelta   流式增量回调，按"句"粒度触发（便于下游 TTS 句级合成）
   * @returns 完整回复文本
   */
  reply(
    sessionId: string,
    userText: string,
    onDelta: (delta: string) => void
  ): Promise<string>;
}
```

**上下文约定：**
- `DialogService` 内部按 `sessionId` 维护 `messages: {role, content}[]`。
- 每轮把 user/assistant 追加进上下文；超过 N 轮做滑动窗口截断（保留 system + 最近 N）。
- system prompt = `Scenario.rolePrompt` + 难度调节指令（语速/用词/追问深度）。

## 4. 行为规约（Behavior）

**正常行为：**
- `greet`：返回符合角色的开场白（如面试官："Hi, thanks for coming in. Shall we start?"）。
- `reply`：
  - 携带历史上下文调用 LLM 流式接口。
  - 每识别出一个完整句子（以 `.?!` 或停顿切分）即调用一次 `onDelta`。
  - 全部生成完后 resolve 完整文本，并把该回复写入上下文。

**边界行为：**
- `userText` 为空字符串 → 不调用 LLM，返回一句礼貌追问（如 "Sorry, I didn't catch that. Could you say it again?"），不污染上下文。
- 上下文超长 → 滑动窗口截断，保留 system + 最近 N 轮。

**异常行为：**
- LLM 调用失败 → 重试 1 次；仍失败 → 返回兜底话术（"Let's continue—could you tell me more?"），不抛断对话；记录错误。
- `onDelta` 回调中抛错 → 不影响整体流程，吞掉并记录。

## 5. 验收标准（Acceptance Criteria）

- [ ] AC1：`greet` 返回非空字符串，且内容受 `rolePrompt` 影响（不同场景开场白不同）。
- [ ] AC2：`reply` 在正常输入下，`onDelta` 至少被调用一次，拼接结果等于返回的完整文本。
- [ ] AC3：`onDelta` 按句触发——多句回复时回调次数 ≥ 句子数。
- [ ] AC4：连续两轮 `reply`，第二轮的 LLM 入参包含第一轮的对话历史（上下文被携带）。
- [ ] AC5：`userText` 为空时不调用 LLM，返回追问话术。
- [ ] AC6：LLM 抛错时不抛出异常，返回兜底话术。
- [ ] AC7：上下文超过窗口上限时被正确截断（保留 system + 最近 N 轮）。

## 6. 测试用例清单（对应 AC）

| 用例 | 类型 | 输入 | 期望 | AC |
|------|------|------|------|-----|
| TC1 | 正常 | scenario=interview | 返回非空开场白；mock LLM 入参含 rolePrompt | AC1 |
| TC2 | 正常 | userText="Hello" | onDelta 拼接 == 返回值 | AC2 |
| TC3 | 正常 | LLM 返回 3 句 | onDelta 调用 ≥3 次 | AC3 |
| TC4 | 正常 | 连续 reply 两次 | 第二次 LLM messages 含第一轮历史 | AC4 |
| TC5 | 边界 | userText="" | 不调用 LLM，返回追问 | AC5 |
| TC6 | 异常 | LLM mock 抛错 | 不抛出，返回兜底话术 | AC6 |
| TC7 | 边界 | 制造超长历史 | messages 被截断到窗口内 | AC7 |

## 7. 实现提示

- 涉及文件：`server/src/modules/dialog.service.ts`（+ 同名 `.test.ts`）。
- 依赖：`lib/llm-client.ts`（注入，测试时 mock）。
- 句切分可用简单正则 `/[^.?!]+[.?!]+/g`，余量 flush。
- 上下文存储黑客松期可用内存 `Map<sessionId, Message[]>`（生产用 Redis，见 SDD）。
- 流式：LLM client 暴露 `stream(messages, onToken)`，service 在其上做句聚合再 `onDelta`。

## 8. DoD
- [ ] AC1–AC7 全部实现
- [ ] TC1–TC7 测试全绿，含正常/边界/异常
- [ ] 仅改动 `dialog.service.ts` 及其测试（外部依赖 mock）
- [ ] 无 TODO/占位；通过 lint 与类型检查
