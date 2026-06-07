# report-export Specification

## Purpose
定义练习报告页的 PNG 导出能力：入口按钮、可导出内容范围、下载行为、加载/空态与错误反馈。纯前端实现，不依赖后端 API。

## Requirements

### Requirement: 报告页展示导出按钮

当练习报告已生成且用户本次有发言（`hasUserSpeech === true`）时，报告页底部操作区 SHALL 在「再练一次」按钮旁渲染 **「导出」** 按钮。无发言空报告态、报告生成中态 MUST NOT 渲染导出按钮。

#### Scenario: 有发言时显示导出按钮
- **WHEN** 用户完成一次有发言的练习并进入报告页，报告数据已就绪
- **THEN** 底部操作区同时显示「导出」与「再练一次」两个按钮

#### Scenario: 无发言时不显示导出按钮
- **WHEN** 用户进入报告页但本次没有任何用户发言（空报告引导态）
- **THEN** 页面不渲染「导出」按钮

#### Scenario: 报告生成中不显示导出按钮
- **WHEN** 报告页处于「报告生成中…」加载态
- **THEN** 页面不渲染「导出」按钮

### Requirement: 导出按钮布局与样式

「导出」与「再练一次」SHALL 并排展示：`sm` 及以上视口为横向 flex 排列，窄屏为纵向堆叠。导出按钮 MUST 使用次要视觉样式（outline 或白底），「再练一次」保持主按钮样式。导出按钮 MUST 带有下载相关图标与文案「导出」。

#### Scenario: 桌面端并排显示
- **WHEN** 视口宽度 ≥ `sm` 断点且报告页处于可导出态
- **THEN** 「导出」与「再练一次」在同一行横向排列，间距一致

#### Scenario: 移动端纵向堆叠
- **WHEN** 视口宽度 < `sm` 断点且报告页处于可导出态
- **THEN** 两个按钮纵向堆叠，均居中显示

### Requirement: 点击导出下载 PNG

用户点击「导出」时，系统 SHALL 将当前报告主体区域截图为 **PNG** 并触发浏览器下载。导出 MUST 在前端完成，MUST NOT 调用后端接口。默认文件名 MUST 为 `spea-report-{YYYY-MM-DD-HHmm}.png`（本地时区，精确到分钟）。

#### Scenario: 成功导出 PNG
- **WHEN** 用户点击「导出」且截图成功
- **THEN** 浏览器下载一个 `.png` 文件，文件名符合 `spea-report-{YYYY-MM-DD-HHmm}.png` 格式

#### Scenario: 导出内容不含导航与操作按钮
- **WHEN** 用户成功导出 PNG
- **THEN** 图片内容包含报告正文（总分、能力分项、雷达图、纠错、总结、成长曲线、对话回顾等），且不包含 sticky 顶栏「返回首页」与底部「导出/再练一次」按钮

### Requirement: 导出过程 loading 态

导出进行中，「导出」按钮 MUST 处于 disabled 状态，文案 MUST 变为「导出中…」。同一时刻 MUST NOT 允许重复触发导出。「再练一次」按钮在导出进行中 SHOULD 保持可点击（不阻塞离开页面）。

#### Scenario: 导出中按钮禁用
- **WHEN** 用户点击「导出」且截图尚未完成
- **THEN** 「导出」按钮 disabled，显示「导出中…」

#### Scenario: 导出完成后恢复
- **WHEN** PNG 下载已成功触发或导出失败已处理完毕
- **THEN** 「导出」按钮恢复可点击，文案恢复「导出」

### Requirement: 导出失败反馈

若截图或下载链失败，系统 MUST 向用户展示简短错误提示（如「导出失败，请重试」），且 MUST NOT 静默失败。错误提示 SHOULD 在数秒后自动消失，用户 MAY 再次点击导出重试。

#### Scenario: 截图失败显示错误
- **WHEN** 用户点击「导出」但 `html2canvas` 或 blob 生成抛出错误
- **THEN** 页面显示「导出失败，请重试」或等价文案，且「导出」按钮恢复可点击

### Requirement: 成长曲线 lazy 加载等待

导出前，若成长曲线区块尚未渲染完成，系统 SHALL 最多等待 **2 秒** 再截图；超时后 MUST 仍执行导出（曲线区可能为加载占位）。若成长数据已加载且曲线容器高度表明已渲染，MUST NOT 额外阻塞。

#### Scenario: 曲线已加载立即导出
- **WHEN** 用户点击「导出」且成长曲线图表已在 DOM 中渲染完成
- **THEN** 系统在 2 秒内开始截图，PNG 中包含成长曲线

#### Scenario: 曲线加载超时仍导出
- **WHEN** 用户点击「导出」后 2 秒内成长曲线仍未渲染完成
- **THEN** 系统仍生成并下载 PNG，不无限等待

### Requirement: 导出工具模块

前端 SHALL 提供可测试的导出函数（如 `exportElementToPng(element, filename)`），封装 `html2canvas` 截图与 programmatic download 逻辑。`Report.tsx` MUST 通过 ref 传入报告主体 DOM 元素调用该函数，MUST NOT 在页面组件内内联重复实现下载链。

#### Scenario: 工具函数接收 DOM 元素
- **WHEN** 调用 `exportElementToPng(element, filename)` 且 `element` 为报告主体容器
- **THEN** 函数对该元素截图并触发与 `filename` 一致的 PNG 下载
