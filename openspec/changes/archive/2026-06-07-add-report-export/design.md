## Context

**当前状态**

- 练习报告页 `web/src/pages/Report.tsx` 在 session store 的 `GeneratedReport` 就绪后渲染：总分/CEFR、能力分项、雷达图（Recharts）、纠错与升级、隐性重述、总结、成长曲线（`GrowthCurve` lazy）、对话回顾。
- 底部操作区仅有一个 **「再练一次」** 按钮（`goHome` → reset + navigate `/`）。
- 无用户发言时走独立空态 UI，不展示分数与导出入口。
- 报告数据已在前端完整可用（`report-generator.ts` → `GeneratedReport`），无需再调 LLM。

**约束**

- 纯前端实现，不新增 REST / WebSocket 接口。
- 新增 npm 依赖须在实现前登记到 `specs/02-SDD.md`（本变更引入 `html2canvas`）。
- 保持现有报告生成与成长落库逻辑不变。
- 移动端与桌面端均需可用（iOS Safari 下载 PNG 通过 `<a download>` + blob URL）。

## Goals / Non-Goals

**Goals:**

1. 「再练一次」旁增加 **「导出」** 按钮，视觉层级为次要按钮（outline/白底），与主按钮并排。
2. 一键下载 **PNG**，内容覆盖用户可见的报告主体（不含 sticky 顶栏与底部操作按钮）。
3. 导出包含雷达图、Recharts SVG、Mascot 等页面内已渲染元素；成长曲线在已加载后一并纳入。
4. 导出过程有 `exporting` 状态（按钮 disabled + 文案「导出中…」）；失败可重试，错误信息简短可见。
5. 提供可单测的 `downloadReportPng(element, filename)` 工具函数。

**Non-Goals:**

- PDF、Markdown、JSON 等多格式导出（后续迭代）。
- 服务端生成或云存储分享链接。
- 导出时重新请求 LLM 生成报告。
- 裁剪/编辑导出内容、水印、自定义品牌模板。
- 无发言空报告态的导出。

## Decisions

### 决策 1：导出格式 — PNG 截图

**决策：** v1 使用 **PNG**（proposal 已确认方向）。

**理由：** 用户分享场景以图片为主（微信/相册）；保留现有排版与图表，实现成本低于服务端 PDF 排版。

**替代方案：**
- **window.print() → PDF**：无新依赖，但移动端体验差、图表分页不可控 → 否决。
- **纯 Markdown 从 `GeneratedReport` 生成**：无图表、与页面所见不一致 → 否决为 v1。

### 决策 2：实现方式 — `html2canvas` 截取 DOM 区域

**决策：** 在 `web` 工作区新增依赖 **`html2canvas`**，对包裹报告主体的 `ref` 容器调用截图，再 `canvas.toBlob('image/png')` + 程序化 `<a download>` 触发保存。

**配置要点：**
- `scale: 2`（Retina 清晰）
- `backgroundColor: '#F5F7FA'`（与 `bg-canvas` 一致，避免透明底）
- `useCORS: true`（若 Mascot 等为外链图）
- `logging: false`

**模块位置：** `web/src/lib/export-report-png.ts`

```typescript
export async function exportElementToPng(element: HTMLElement, filename: string): Promise<void>
```

**理由：** 与当前 React 页面结构一致，无需 duplicate 报告 UI；Recharts 输出 SVG，`html2canvas` 社区验证可捕获。

**替代方案：**
- **手动 Canvas 绘制**：工作量大、与 UI 漂移 → 否决。

### 决策 3：可导出 DOM 范围 — 专用 `reportExportRef` 容器

**决策：** 在 `Report.tsx` 中，将 **Header（Mascot + 标题）至对话回顾** 包在 `<div ref={reportExportRef}>` 内；**排除**：
- sticky 顶部导航（「返回首页」）
- 底部操作区（再练一次 / 导出）
- `LevelUpCelebration` 弹层（导出时若打开应先关闭或天然不在 ref 内）

**包含区块：** RewardBanner、总分、能力分项、雷达+纠错 grid、重述、总结、成长曲线、对话回顾。

**理由：** 导出图应像「报告正文」，不含导航与操作控件。

### 决策 4：成长曲线 lazy 加载 — 导出前短等待

**决策：** `GrowthCurve` 为 `lazy()` + `Suspense`。导出前：
1. 若 `growthSessions.length > 0` 且 ref 内 growth 区块高度 > 阈值（如 80px），视为已渲染，直接截图。
2. 否则 `await` 最多 **2s**（`requestAnimationFrame` 轮询或固定 delay），超时仍截图（曲线区可能为「加载中」占位——可接受边缘情况）。

**理由：** 多数情况下 `loadGrowth()` 在 mount 时已并行完成；2s 上限避免按钮卡死。

### 决策 5：UI 布局与交互

**决策：**

```tsx
<div className="flex flex-col sm:flex-row gap-3 justify-center pb-8">
  <button /* 导出 */ disabled={exporting} className="... outline/白底 ..." />
  <button /* 再练一次 */ ... />
</div>
```

- 导出按钮文案：默认「导出」+ `DownloadIcon`；进行中「导出中…」。
- 失败：`setExportError('导出失败，请重试')` 在按钮上方显示一行红色小字，3s 后清除。
- 无 `report` / `!hasSpeech` 分支不渲染导出按钮（与 proposal 一致）。

**顺序：** 移动端竖排时 **导出在上、再练一次在下**（次要操作不挡主 CTA）；`sm+` 横排导出在左、再练一次在右（或导出在右——实现时与视觉稿对齐，推荐 **左导出、右再练** 突出主按钮）。

### 决策 6：文件名

**决策：** `spea-report-{YYYY-MM-DD-HHmm}.png`，用 `Intl` 或手动格式化本地时间，不含秒（避免同分钟重复可后续加随机后缀，v1 不加）。

### 决策 7：测试策略

| 文件 | 覆盖 |
|------|------|
| `export-report-png.test.ts` | mock `html2canvas` 与 `URL.createObjectURL`；断言传入 element、blob 下载链被调用 |
| 可选 E2E | Report 页有「导出」按钮且 `hasSpeech` 时可见 |

不 mock 真实 canvas 像素内容。

## Risks / Trade-offs

- **[Risk] html2canvas 对 Recharts/SVG 渲染不完整** → 导出前确保 chart 已 paint；`scale:2`；若有个别浏览器空白，文档记录已知限制，后续可换 `dom-to-image-more`。
- **[Risk] 长对话回顾导致 PNG 超高、内存占用** → v1 接受单张长图；极端会话可在 Open Questions 跟踪分页导出。
- **[Risk] iOS Safari `download` 属性行为** → 使用 blob URL + 新窗口 fallback（`window.open(url)`）作为 design 实现备注。
- **[Risk] 导出时用户滚动导致截取偏移** → 截图前 `element.scrollIntoView({ block: 'start' })` 或固定从元素顶部截取（html2canvas 默认按元素 box）。

## Migration Plan

1. `npm install html2canvas -w web`，更新 `specs/02-SDD.md` 依赖表。
2. 新增 `web/src/lib/export-report-png.ts` + 单测。
3. `Report.tsx`：加 `reportExportRef`、`exporting` state、双按钮 UI、调用导出。
4. 手动验证：Chrome 桌面、iOS Safari（若可）下载 PNG 可打开且含雷达图。

**回滚：** 移除依赖与按钮，删除 `export-report-png.ts` 即可，无数据迁移。

## Open Questions

1. **按钮顺序**：移动端是否坚持「再练一次」在上方更显眼？—— 实现 tasks 阶段按 UI 走查确认。
2. **超长报告**：单 PNG 超过 15000px 高度是否需截断或分页？—— v1 不处理，收集反馈后再开变更。
