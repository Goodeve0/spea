## ADDED Requirements

### Requirement: 齿轮按钮入口

对话页（`Conversation.tsx`）的 Header 区域 SHALL 在 "End Session" 按钮左侧渲染一个齿轮图标 ⚙️ 按钮。点击 SHALL 打开设置面板。

#### Scenario: 进入对话页可见齿轮
- **WHEN** 用户从场景选择页跳转到 `/conversation`
- **THEN** Header 右侧出现齿轮按钮，aria-label 为 "Settings"

#### Scenario: 点击打开面板
- **WHEN** 用户点击齿轮按钮
- **THEN** 设置面板（Modal 或 Drawer）渲染到 DOM，背景遮罩可点击关闭

### Requirement: TTS 引擎选择

设置面板 SHALL 提供单选控件（radio / segmented control），让用户在 "浏览器（默认）" 与 "讯飞" 之间二选一。当前选中项 MUST 来自 zustand `settings` store 的 `ttsEngine` 字段，变更 MUST 同步写入 `localStorage`。

#### Scenario: 切换为讯飞
- **WHEN** 用户在面板上选中 "讯飞"
- **THEN** `settings.ttsEngine` 立即变为 `'iflytek'`，`localStorage['speak-coach.settings'].ttsEngine === 'iflytek'`

#### Scenario: 刷新页面后保持
- **WHEN** 用户切换为讯飞后关闭浏览器再次打开
- **THEN** 面板仍显示 "讯飞" 为选中态

### Requirement: 音色选择

当 `ttsEngine === 'iflytek'` 时，面板 SHALL 显示音色下拉选择器，选项来自 `web/src/audio/iflytek-voices.ts` 静态列表（至少包含 4 个英文音色）。当 `ttsEngine === 'browser'` 时音色选择器 MUST 隐藏或置灰。

#### Scenario: 切到讯飞才出现音色
- **WHEN** 用户先选 "讯飞"
- **THEN** 下方出现音色下拉，默认选中 `x4_EnUs_Catherine`

#### Scenario: 浏览器引擎下隐藏音色
- **WHEN** 当前为 "浏览器"
- **THEN** 音色下拉不渲染或处于 disabled 灰态

### Requirement: 即时生效

设置变更 MUST NOT 要求刷新页面或重新进入对话。下一次 AI 回复（或用户手动重听）SHALL 直接使用新引擎与新音色。

#### Scenario: 对话中切换音色
- **WHEN** 用户在 AI 回复 "Welcome..." 期间切换音色
- **THEN** 当前句子可继续以旧音色播完（不强制中断），下一句 AI 回复使用新音色

### Requirement: 不可用引擎的可视化提示

当讯飞被选中但后端报告 `tts.error`（如 key 缺失）后，面板 SHALL 在讯飞选项旁显示警告标记 ⚠️，hover 显示提示文案 "讯飞 TTS 不可用，请检查后端 .env 配置"。

#### Scenario: 后端 key 未配
- **WHEN** 讯飞首次 `tts.request` 收到 `tts.error { code: 'TTS_FAILED' }`
- **THEN** 设置 store 记录 `iflytekDisabled = true`，面板对应选项渲染警告并禁用
