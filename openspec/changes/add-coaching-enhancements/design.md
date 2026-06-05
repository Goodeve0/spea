# Design · add-coaching-enhancements

> 技术方案。唯一事实来源仍是 `shared/contracts.ts` 与各 capability 的 spec.md，本文解释"怎么实现、为什么这么选"。

## 1. 总体思路

三大主题全部落在**前端 + LLM prompt 层**，不强依赖后端改造，符合黑客松小步快跑：

| 主题 | 触点 | 是否需要后端 |
|------|------|--------------|
| 递台阶 Hint Engine | 对话页静默检测 + 一次轻量 LLM 调用 | 否（走前端 LLM 客户端） |
| 隐性重述 Recast | LLM 在回复时顺带产出 recast 标记 + 报告回放 | 否 |
| "为什么"报告 + 成长曲线 | report-generator prompt 扩字段 + 本地持久化 | 否（本地存储） |

## 2. 契约变更（`shared/contracts.ts`）

遵循"能复用就不新增"的原则：

```ts
// 新增：隐性重述记录
export interface Recast {
  turnId: string;
  original: string;   // 用户原话
  recast: string;     // AI 给出的更地道/正确说法
}

// 修改：表达升级新增"为什么"
export interface ExpressionUpgrade {
  from: string;
  to: string;
  why: string;        // 新增：为什么更地道（口语化中文）
}

// 修改：报告新增 recasts 与可选 CEFR 估算
export interface Report {
  // ...existing fields...
  recasts: Recast[];           // 新增
  cefrEstimate?: string;       // 新增（如 "B1"），UI 标注"估算"
}

// 新增：本地持久化的会话记录（成长曲线数据源）
export interface StoredSession {
  id: string;
  timestamp: number;
  scenarioId: string;
  difficulty: Difficulty;
  radar: RadarScores;
  overallScore: number;
  cefrEstimate?: string;
}
```

**关于"为什么"纠错**：`Correction` 已有 `explanation` 字段，语义即"为什么这样改"。本变更**复用 `Correction.explanation`** 承载纠错原因（在 prompt 里强约束其为口语化中文、必须解释原因），仅对缺 `explanation` 的条目做兜底默认值；只对 `ExpressionUpgrade` 新增 `why`（原本没有）。这样避免契约里出现 `explanation` 与 `why` 两个同义字段。

## 3. 模块设计

### 3.1 递台阶 Hint Engine
- `web/src/hooks/useStallDetector.ts`：封装静默计时。依赖 `isRecording`、`textInput`、`isAiSpeaking`、`isLoading`；AI 朗读/思考中不计时；用户开始录音或输入即重置并隐藏提示。默认阈值 6s（常量，预留设置项）。
- `web/src/llm/hint-generator.ts`：`generateHints(scenario, history, difficulty): Promise<{ opener: string; suggestions: string[] }>`。失败/超时返回 `null`，调用方静默忽略。
- `Conversation.tsx`：消费 hook，在输入区上方非模态渲染提示气泡 + 2–3 个示例回答按钮；点击按钮 = 调用现有 `handleUserMessage(text)`。

### 3.2 隐性重述 Recast
- LLM 主回复 prompt（`Conversation.tsx` 的 `buildMessages`）已要求 AI 保持角色 + 自然重述。本变更在 **report 阶段**由 `report-generator.ts` 从完整对话里抽取 recast（更稳，不污染实时流式文本）。
- `Report` 渲染新增"重述回放"区：`original → recast` 对照；空态正向鼓励。
- （可选增强）实时阶段仅做轻提示：用户轮次旁出现一个不打断的小角标，点开才看到 recast；默认关闭，避免干扰。

### 3.3 "为什么"报告 + 成长曲线
- `report-generator.ts`：扩展 system prompt，要求产出
  - 每条 correction 的 `explanation`（口语化中文、解释原因）
  - 每条 expressionUpgrade 的 `why`
  - `recasts` 数组
  - `cefrEstimate`
  并对所有新增字段做**解析兜底**（缺失填安全默认值，保证 UI 不缺块）。
- `web/src/store/history.ts`：持久层封装。优先 IndexedDB，失败回退 localStorage；导出 `saveSession(StoredSession)`、`listSessions(): StoredSession[]`、`computeStreak()`、`computeTotalXp()`。
- `web/src/components/GrowthCurve.tsx`：`React.lazy` 懒加载 recharts 折线图，展示 5 维历史趋势；< 2 次会话显示引导空态。
- `Report.tsx`：报告生成成功后调用 `saveSession`，并渲染成长曲线区与 CEFR 标签。
- `ScenarioHub.tsx`：顶部状态栏 streak/XP 改为读 `history` 真实数据（替换当前占位）。

## 4. 关键决策

1. **不引入后端存储**：本期范围边界明确"本地匿名 session、不做账号体系"（PRD §7）。成长数据先落本地，足够支撑 Demo 的成长曲线"哇时刻"。
2. **recast 在报告阶段抽取而非实时流式**：避免破坏现有流式渲染与 `stripMarkdown` 逻辑，稳定性优先。
3. **hint 失败必须静默**：递台阶是锦上添花，任何异常都不得影响主对话链路。
4. **复用 explanation 而非新增 why（纠错侧）**：减少契约冗余，降低前后端同步成本。

## 5. 风险与回退

| 风险 | 缓解 |
|------|------|
| 卡壳阈值打扰用户 | 默认 6s + 用户一开口即消失；预留设置项 |
| LLM 新字段不稳定 | report-generator 全字段兜底，缺失不白屏 |
| 隐私模式存储失败 | history 写入 try/catch，成长曲线降级提示，不阻断报告 |
| recharts 体积 | GrowthCurve 懒加载 |

## 6. 测试要点（TDD）

- `useStallDetector`：阈值触发 / 输入重置 / AI 朗读中不触发（vitest + fake timers）。
- `hint-generator`：成功返回结构 / 失败返回 null。
- `report-generator`：新字段解析 + 缺失兜底。
- `history`：save/list/streak 计算；存储失败降级。
- 契约 `contracts.test.ts`：新增类型的形状校验。
