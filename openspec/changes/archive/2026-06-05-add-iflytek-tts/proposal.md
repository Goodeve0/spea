## Why

当前 AI 回复的语音由浏览器原生 `SpeechSynthesis` 合成，英文音色机械、断句生硬，作为口语陪练的"陪练同学"听感差，影响沉浸式练习体验。讯飞在线 TTS（流式 WS）能提供自然的英文音色，且可在后端中转避免在浏览器中暴露 AppId/ApiKey/ApiSecret。

## What Changes

- 新增 **讯飞在线流式 TTS 后端中转**：`server/modules/tts.service.ts` 新增 `IflytekTtsService`，通过讯飞官方 WebSocket 接口合成语音，按帧推流回前端。
- 新增 **TTS 引擎抽象**：前端 `web/src/audio/` 下新增 `tts-engine.ts`（统一接口）、`iflytek-tts-client.ts`（消费后端 WS 帧、Web Audio API 拼装播放）；保留现有 `BrowserSpeechSynthesis` 作为可选引擎。
- 新增 **设置入口**：对话页右上角新增 ⚙️ 齿轮按钮，弹出设置面板，可切换 TTS 引擎（浏览器 / 讯飞）与音色（仅讯飞引擎下生效）。设置持久化到 `localStorage`。
- 新增 **WebSocket 消息类型**：在 `shared/contracts.ts` 增加 `tts.request` / `tts.audio` / `tts.done` / `tts.error` 消息类型，让前端可以独立请求 TTS（不必依附 AI 回复流程）。
- 新增 **环境变量**：`server/.env`（或根 `.env`）新增 `IFLYTEK_APP_ID` / `IFLYTEK_API_KEY` / `IFLYTEK_API_SECRET`；缺失时讯飞引擎不可用，前端在设置面板上禁用并提示。
- **Modified**：`Conversation.tsx` 中所有 `synthesisRef.current?.speak(...)` 改为统一从引擎工厂获取当前引擎实例并调用，引擎切换不需要刷新页面。

## Capabilities

### New Capabilities

- `tts-engine`：定义前端 TTS 引擎统一接口、引擎注册表与工厂；约束：必须支持 `speak(text, onEnd)` 与 `stop()`、必须暴露 `isAvailable()` 用于 UI 判断、引擎切换不打断当前正在播放的句子（先 stop 再切）。
- `iflytek-tts-bridge`：定义后端讯飞 TTS 中转能力；约束：通过 WebSocket 接收 `tts.request`、用讯飞鉴权算法签名、按帧把 PCM/MP3 音频回推给前端；缺 key 时返回 `tts.error` 而不是崩溃。
- `tts-settings-ui`：定义对话页的设置面板能力；约束：齿轮按钮可视化、面板提供引擎切换 + 音色下拉、设置写入 `localStorage` 并广播给当前对话页生效。

### Modified Capabilities

（无 — 当前仓库 `openspec/specs/` 为空，所有相关行为由本变更首次形式化为规格。）

## Impact

**前端**
- 修改：`web/src/pages/Conversation.tsx`（替换直接 `BrowserSpeechSynthesis` 调用为引擎抽象）
- 新增：`web/src/audio/tts-engine.ts`、`web/src/audio/iflytek-tts-client.ts`、`web/src/components/SettingsPanel.tsx`、`web/src/store/settings.ts`

**后端**
- 修改：`server/src/modules/tts.service.ts`（新增 `IflytekTtsService`，保留 `OpenAITtsService`）
- 修改：`server/src/gateway/ws-gateway.ts`（注册 `tts.request` 消息处理器）
- 新增：`server/src/lib/iflytek-auth.ts`（HMAC-SHA256 签名）

**契约**
- 修改：`shared/contracts.ts`（新增 4 个 TTS 消息类型与 payload）

**配置**
- 新增 `.env` 项：`IFLYTEK_APP_ID` / `IFLYTEK_API_KEY` / `IFLYTEK_API_SECRET`
- 文档：`.env.example` 同步说明

**依赖**
- 后端新增：`ws`（已有）；如需 PCM 转 MP3，再评估是否引入 `lamejs` 等编码库
- 前端不新增第三方依赖（用浏览器原生 Web Audio API）

**风险**
- 讯飞 WS 鉴权错误会导致连不上 → 在 service 层兜底返回 `tts.error`，前端回退到浏览器引擎
- 内网环境是否能直连 `iat-api.xfyun.cn` 待验证 → 若不通，用户需自配代理或使用浏览器引擎
