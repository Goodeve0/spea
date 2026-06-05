## 1. 契约（shared/contracts.ts）

- [x] 1.1 新增 `Recast { turnId: string; original: string; recast: string }`
- [x] 1.2 `ExpressionUpgrade` 新增 `why: string`
- [x] 1.3 `Report` 新增 `recasts: Recast[]` 与可选 `cefrEstimate?: string`
- [x] 1.4 新增 `StoredSession { id; timestamp; scenarioId; difficulty; radar; overallScore; cefrEstimate? }`
- [ ] 1.5 `shared/contracts.test.ts` 补新增类型的形状校验

## 2. 递台阶 Hint Engine

- [x] 2.1 新建 `web/src/hooks/useStallDetector.ts`：静默计时（默认 6s），AI 朗读/思考中不计时，用户录音或输入即重置
- [x] 2.2 `web/src/hooks/useStallDetector.test.ts`：阈值触发 / 输入重置 / 朗读中不触发（fake timers）
- [x] 2.3 新建 `web/src/llm/hint-generator.ts`：`generateHints(scenario, history, difficulty)` 返回 `{ opener, suggestions[] }`，失败/超时返回 `null`
- [x] 2.4 `hint-generator.test.ts`：成功返回结构 / 失败返回 null
- [x] 2.5 `Conversation.tsx` 接入：输入区上方非模态渲染提示气泡 + 2–3 个示例回答按钮；点击按钮调用 `handleUserMessage`
- [x] 2.6 用户开始录音/输入时隐藏提示；hint 生成失败静默忽略

## 3. 隐性重述 Recast

- [x] 3.1 `report-generator.ts`：从完整对话抽取 recast，产出 `recasts: Recast[]`
- [x] 3.2 缺失/解析失败时 `recasts` 兜底为 `[]`
- [x] 3.3 `Report.tsx` 新增"重述回放"区：`original → recast` 对照；无 recast 显示正向空态
- [ ] 3.4（可选）实时阶段用户轮次旁加不打断的 recast 小角标，默认关闭

## 4. "为什么"式纠错

- [ ] 4.1 `report-generator.ts` system prompt 强约束：correction.explanation 为口语化中文且解释"为什么"
- [x] 4.2 expressionUpgrade 产出 `why` 字段
- [x] 4.3 解析兜底：缺 `explanation` / `why` 时填安全默认值，保证非空
- [x] 4.4 `Report.tsx`：纠错条目展示原因；表达升级展示 `why`
- [ ] 4.5 `report-generator.test.ts`：新字段解析 + 缺失兜底

## 5. 成长档案与成长曲线

- [x] 5.1 新建 `web/src/store/history.ts`：localStorage 持久化；`saveSession` / `listSessions` / `computeStreak` / `computeTotalXp`
- [x] 5.2 `history.test.ts`：save/list/streak 计算；存储失败降级不抛错
- [x] 5.3 `Report.tsx`：报告生成成功后调用 `saveSession`（仅有发言时）
- [x] 5.4 新建 `web/src/components/GrowthCurve.tsx`：`React.lazy` 懒加载 recharts 折线图，展示 5 维历史趋势
- [x] 5.5 历史 < 2 次时 GrowthCurve 显示引导空态，不报错
- [x] 5.6 `report-generator.ts` 产出 `cefrEstimate`；`Report.tsx` 展示 "≈ Bx（估算）" 标签
- [x] 5.7 `ScenarioHub.tsx` 顶部状态栏 streak/XP 改读 `history` 真实数据（替换占位）

## 6. 验证与文档

- [ ] 6.1 手动验证：卡壳 6s 出现递台阶且可点选；报告含"为什么"与重述回放；练 2 次后出现成长曲线
- [ ] 6.2 单测全绿：`npm test -w web` & `npm test -w shared` 不报错
- [ ] 6.3 类型检查通过：`npm run lint -w web`
- [ ] 6.4 更新 `英语口语陪练-技术方案.md`：记录三大能力的实现与数据流
