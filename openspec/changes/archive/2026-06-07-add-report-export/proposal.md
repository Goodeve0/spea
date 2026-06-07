## Why

用户完成练习后，报告页（雷达图、成长曲线、对话回顾、改进建议）只能在浏览器内查看，无法保存或分享给老师/自己复盘。在「再练一次」旁提供**导出**，让用户把当次报告留存到本地，提升练习闭环与传播价值。

## What Changes

- 在 `Report.tsx` 底部操作区，「再练一次」按钮旁新增 **「导出」** 按钮（并排布局，移动端可堆叠或等宽双列）。
- 点击导出后，将**当前已生成的完整报告**下载为 **PNG 图片**（含综合分、雷达图、主要文字区块与对话回顾；成长曲线若异步未渲染则导出时等待或跳过——具体见 design）。
- 导出过程纯前端完成，使用 session store 中已有的 `GeneratedReport` 与页面 DOM，**不新增后端 API**。
- 导出中显示 loading/disabled 态；失败时 toast 或 inline 提示，不阻塞「再练一次」。
- 无用户发言的空报告态（「这次还没听到你说话」）**不展示**导出按钮，与「不展示分数」策略一致。
- 默认文件名：`spea-report-{YYYY-MM-DD-HHmm}.png`（本地时区）。

## Capabilities

### New Capabilities

- `report-export`: 练习报告页导出能力——按钮入口、PNG 下载、内容范围、空报告/加载态行为、错误反馈。

### Modified Capabilities

（无 — 不修改现有 TTS、朗读等规格）

## Impact

- **前端 UI**：`web/src/pages/Report.tsx`（底部双按钮、导出触发）
- **新模块**：`web/src/lib/export-report.ts` 或 `web/src/pages/report-export.ts`（DOM 截图 + 下载，具体见 design）
- **依赖**：预计引入 `html2canvas`（或等价方案）用于页面区域转 PNG；须在 `specs/02-SDD.md` 登记前于 design 确认
- **测试**：导出工具函数单测（mock canvas）；可选 Playwright 冒烟「导出按钮可见且可点击」
- **不涉及**：`shared/contracts.ts`、WebSocket、`report.service` 服务端逻辑
