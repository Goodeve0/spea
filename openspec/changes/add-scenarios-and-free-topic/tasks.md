## 1. 契约与场景库（shared）

- [x] 1.1 `Scenario` 新增可选 `category` 字段
- [x] 1.2 新增 `SCENARIO_CATEGORIES`（career/life/travel/social/exam）
- [x] 1.3 `PRESET_SCENARIOS` 扩充到 9 个，覆盖 5 个分类
- [x] 1.4 新增 `buildFreeTopicScenario(topic, difficulty): Scenario`
- [x] 1.5 `contracts.test.ts`：场景数量 ≥9、含 category、自由话题生成（6 绿）

## 2. 前端：场景解析

- [x] 2.1 新建 `web/src/lib/scenario.ts`：`getActiveScenario()` 解析预设/自定义；`setCustomScenario()`

## 3. 前端：首页

- [x] 3.1 `ScenarioHub.tsx` 场景按分类分组展示
- [x] 3.2 自由话题入口（输入主题 → 写入自定义场景 → 开练）
- [x] 3.3 随机场景按钮

## 4. 前端：对话页

- [x] 4.1 `Conversation.tsx` 用 `getActiveScenario()` 取代写死查找（init/发消息/递台阶/头部）
- [x] 4.2 开场白支持自定义场景（自由话题 fallback 通用开场）
- [x] 4.3 头部标题/图标支持自定义与新场景

## 5. 验证

- [x] 5.1 shared 契约测试通过
- [x] 5.2 web 类型检查 + 全量测试通过（35）
