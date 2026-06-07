## 1. 依赖与规格登记

- [x] 1.1 在 `web` 工作区安装 `html2canvas`（`npm install html2canvas -w web`）
- [x] 1.2 在 `specs/02-SDD.md` 第 1.1 节技术栈表中登记 `html2canvas` 及用途（报告页 DOM 截图导出 PNG）

## 2. 导出工具模块

- [x] 2.1 新增 `web/src/lib/export-report-png.ts`，实现 `exportElementToPng(element, filename)`：`html2canvas` 配置 `scale:2`、`backgroundColor:'#F5F7FA'`、`useCORS:true`；`canvas.toBlob('image/png')` + `<a download>` 触发下载；截图前 `element.scrollIntoView({ block: 'start' })`
- [x] 2.2 新增 `web/src/lib/export-report-png.test.ts`：mock `html2canvas`、`URL.createObjectURL`、`URL.revokeObjectURL` 与 DOM `<a>` click；断言传入 element、filename 及 blob 下载链被调用

## 3. 报告页 UI 集成

- [x] 3.1 在 `web/src/components/icons.tsx` 新增 `DownloadIcon`（与现有 Icon 风格一致）
- [x] 3.2 在 `Report.tsx` 用 `reportExportRef` 包裹报告正文（Header/Mascot 至对话回顾），排除 sticky 顶栏与底部操作区
- [x] 3.3 新增 `exporting`、`exportError` state 与 `handleExport`：生成文件名 `spea-report-{YYYY-MM-DD-HHmm}.png`；导出前对成长曲线最多等待 2s（高度阈值或超时仍继续）；失败时显示「导出失败，请重试」并在 3s 后清除
- [x] 3.4 底部操作区改为 flex 双按钮：`sm+` 横排（左导出 outline、右再练一次 primary），窄屏纵向堆叠（导出在上）；导出中 disabled +「导出中…」；仅在 `hasSpeech` 且有 `report` 时渲染导出按钮

## 4. 验证

- [x] 4.1 运行 `npm test -w web -- export-report-png` 与 `npm run lint -w web`，确保通过
- [x] 4.2 手动验证：完成一次有发言的练习 → 报告页点击「导出」→ PNG 可打开且含雷达图、总结、对话回顾；无发言空态与「报告生成中…」态不显示导出按钮
