## 1. 契约与配置

- [x] 1.1 在 `shared/contracts.ts` 的 `ClientMessageType` 中新增 `'tts.request'`
- [x] 1.2 在 `shared/contracts.ts` 的 `ServerMessageType` 中新增 `'tts.audio' | 'tts.done' | 'tts.error'`
- [x] 1.3 在 `ClientPayload` namespace 新增 `TtsRequest { requestId: string; text: string; voice?: string }`
- [x] 1.4 在 `ServerPayload` namespace 新增 `TtsAudio { requestId: string; seq: number; audio: string }`、`TtsDone { requestId: string }`、`TtsError { requestId: string; code: ErrorCode; message: string }`
- [x] 1.5 在根 `.env.example` 复用现有 `XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET`（同一账号支持发音评测与 TTS），并在注释中补一行 "TTS 需在讯飞控制台对该 AppId 开通 '在线语音合成（流式版）' 服务"
- [x] 1.6 在 `web/src/audio/iflytek-voices.ts` 新增静态音色列表（至少 4 个英文音色，每项 `{ id, label, gender, preview? }`）

## 2. 后端：讯飞鉴权与 TTS 服务

- [x] 2.1 复用既有 `server/src/lib/xfyun-auth.ts`：抽出通用 `buildXfyunWsAuthUrl(host, path, apiKey, apiSecret)`，在其上新增 `buildXfyunTtsAuthUrl()`（连 `wss://tts-api.xfyun.cn/v2/tts`，缺 key 抛错）
- [x] 2.2 在 `server/src/lib/xfyun-auth.test.ts` 加单元测试：覆盖 "key 缺失抛错"、"返回 URL 含 authorization/date/host 三个 query"（使用 `XFYUN_*` 环境变量）
- [x] 2.3 在 `server/src/modules/tts.service.ts` 新增 `IflytekTtsService implements ITtsService`：连接 wss、发送鉴权 + 合成参数（`common`/`business`/`data` 三段）、按帧解 base64 后调用 `onChunk`
- [x] 2.4 `IflytekTtsService` 的 `synthesize` 接受可选 `voice` 参数（默认 `x4_EnUs_Catherine`），传给讯飞 `business.vcn`
- [x] 2.5 讯飞返回 `code != 0` 时 reject `Error('Iflytek TTS error: <code> <message>')`
- [x] 2.6 `server/src/modules/tts.service.test.ts` 加 mock 测试：mock WebSocket，验证按帧回调与失败 reject

## 3. 后端：WS 网关 TTS 路由

- [x] 3.1 在 `ws-gateway.ts` 构造函数额外注入 `IflytekTtsService`（或保持单一 `ttsService` 字段，由 `main.ts` 注入讯飞实例）
- [x] 3.2 在 `handleMessage` switch 中新增 `case 'tts.request'`，路由到 `handleTtsRequest`
- [x] 3.3 实现 `handleTtsRequest(ws, payload)`：调用讯飞服务、按帧 send `tts.audio`（base64 编码）、完成 send `tts.done`、失败 send `tts.error`
- [x] 3.4 `handleTtsRequest` 不依赖 session.start，独立工作
- [x] 3.5 `server/src/main.ts` 注册 `IflytekTtsService` 实例，但仍保留现有 `OpenAITtsService` 用于对话主链路（不破坏既有行为）

## 4. 前端：引擎抽象层

- [x] 4.1 新建 `web/src/audio/tts-engine.ts`：定义 `ITtsEngine` 接口（`speak/stop/isAvailable/dispose`），定义 `EngineId = 'browser' | 'iflytek'`
- [x] 4.2 在 `tts-engine.ts` 实现注册表 `Map<EngineId, ITtsEngine>`、`registerEngine`、`getCurrentEngine()`
- [x] 4.3 改造 `web/src/audio/speech-synthesis.ts`：导出 `BrowserSpeechSynthesisEngine` 类实现 `ITtsEngine`（保留旧类名为向后兼容别名）
- [x] 4.4 新建 `web/src/audio/iflytek-tts-client.ts`：实现 `IflytekTtsEngine`，内部维护单例 WebSocket（`ws://localhost:3001`），发 `tts.request`、收 `tts.audio` 帧拼装播放
- [x] 4.5 `IflytekTtsEngine` 用 Web Audio API 播放 PCM 16kHz/16bit/mono：每帧 base64 解码 → Int16Array → Float32Array → AudioBufferSourceNode 队列调度（`start(prevEnd)`）
- [x] 4.6 `IflytekTtsEngine.isAvailable()` 实现：尝试 WS 连接，5s 超时返回 false
- [x] 4.7 `IflytekTtsEngine` 在收到 `tts.error` 时调用 `onEnd` 并设置 `disabled=true`
- [x] 4.8 `getCurrentEngine()` 在新引擎不可用时自动 fallback 到 browser 并 `console.warn`

## 5. 前端：设置 store 与持久化

- [x] 5.1 新建 `web/src/store/settings.ts`：zustand store，schema `{ ttsEngine: EngineId, iflytekVoice: string, iflytekDisabled: boolean }`
- [x] 5.2 store 订阅变化写入 `localStorage['speak-coach.settings']`，初始化时读回
- [x] 5.3 默认值 `{ ttsEngine: 'browser', iflytekVoice: 'x4_EnUs_Catherine', iflytekDisabled: false }`

## 6. 前端：设置面板 UI

- [x] 6.1 新建 `web/src/components/SettingsPanel.tsx`：受控 Modal，props `{ open, onClose }`，背景遮罩可关
- [x] 6.2 面板内容：TTS 引擎单选（browser / iflytek）+ 音色下拉（仅 iflytek 可见）
- [x] 6.3 选项 onChange 直接写入 settings store
- [x] 6.4 当 `iflytekDisabled === true` 时讯飞选项渲染 ⚠️ + title="讯飞 TTS 不可用，请检查后端 .env 配置"，且 disabled
- [x] 6.5 在 `Conversation.tsx` Header 加齿轮按钮（aria-label="Settings"），点击切换 `settingsOpen` 状态、渲染 `SettingsPanel`

## 7. 前端：对话页接入引擎工厂

- [x] 7.1 替换 `Conversation.tsx` 中 `synthesisRef = new BrowserSpeechSynthesis()` 为 `getCurrentEngine()`
- [x] 7.2 所有 `synthesisRef.current?.speak(text, onEnd)` 改为 `getCurrentEngine().speak(text, onEnd)`
- [x] 7.3 监听 `settings.ttsEngine` 变化：变化前 `getCurrentEngine().stop()` 中断旧引擎
- [x] 7.4 收到 `tts.error` 时 `settings.setIflytekDisabled(true)` 并 fallback 调用浏览器引擎重新朗读当前句

## 8. 验证与文档

- [x] 8.1 手动验证：选 browser 时与现状一致；选 iflytek 时音色自然、可切换；后端去掉 key → UI 出现警告并自动回退
- [x] 8.2 单测全绿：`npm test -w server` & `npm test -w web` 不报错
- [x] 8.3 在 `.env.example` 注释里写明讯飞控制台开通入口与音色 ID 速查
- [x] 8.4 更新 `英语口语陪练-技术方案.md`（或新建 `docs/tts.md`）：记录引擎抽象 + 讯飞接入流程 + 故障排查
- [x] 8.5 运行 `openspec validate add-iflytek-tts` 通过
