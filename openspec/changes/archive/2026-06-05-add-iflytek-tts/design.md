## Context

**当前状态**
- 仓库已存在两套并行实现：
  - `web/src/pages/Conversation.tsx` 直接在浏览器调用 LLM HTTP API（OpenAI 兼容协议），用 `BrowserSpeechSynthesis` 朗读 AI 回复 —— 这是当前实际跑通的对话路径。
  - `server/src/gateway/ws-gateway.ts` + `tts.service.ts` + `dialog.service.ts` 是一套完整的 WebSocket 管线，但前端**未连接**这条 WS，因此后端 TTS 服务实际未被调用。
- 浏览器 SpeechSynthesis 的英文音色机械、断句生硬，用户反馈作为口语陪练的"陪练同学"听感差，希望换成讯飞自然语音。
- 用户在设置面板希望选择 TTS 引擎（浏览器 / 讯飞）以及音色。

**约束**
- 讯飞鉴权三件套（AppId/ApiKey/ApiSecret）不能进前端 bundle，必须后端中转。
- 当前对话流程（前端直连 LLM）能用，不希望大改重构。
- 内网/外网环境差异：讯飞域名 `tts-api.xfyun.cn` 在企业内网代理下可能不通，方案需对此降级友好。

**相关方**
- 用户（最终听众）：希望音色自然、可切换、可配置音色
- 开发者（接手者）：希望抽象清晰，未来加 Azure/Google TTS 时不再大改

## Goals / Non-Goals

**Goals**
1. 前端引入 TTS 引擎抽象层 `ITtsEngine`，浏览器 / 讯飞两种实现可热切换。
2. 后端 `IflytekTtsService` 实现讯飞在线流式 TTS，签名鉴权封装在独立模块。
3. 新增独立的 WebSocket TTS 通道：复用 `ws-gateway.ts`，注册 `tts.request` / `tts.audio` / `tts.done` / `tts.error` 四个消息类型，不再要求前端把整个对话流程切到 WS。
4. 对话页加齿轮 ⚙️ 设置面板：引擎切换 + 音色选择，写 `localStorage` 即时生效。
5. 讯飞失败 / Key 缺失 → 自动回退到浏览器引擎 + 在 UI 上提示原因。

**Non-Goals**
- 不重写整个 `Conversation.tsx` 的对话流程；LLM 调用维持现状。
- 不实现 Azure / Google / OpenAI 等其他 TTS 引擎（只搭抽象，不堆实现）。
- 不做发音克隆、超拟人音色（费用与配额限制）。
- 不在本变更里把 ASR 也切到讯飞。

## Decisions

### 决策 1：前端引擎抽象 + 工厂注册表
**选择**：定义 `ITtsEngine` 接口（`speak / stop / isAvailable / dispose`），用 `Map<EngineId, ITtsEngine>` 作为注册表，`getCurrentEngine()` 从 `settings.store` 读当前选项返回实例。
**为什么**：未来加新引擎只需 `register('xxx', new XxxEngine())`，不需碰 `Conversation.tsx`。
**替代方案**：在 `Conversation.tsx` 内 `if/else` 选引擎 —— 简单但每加一个引擎污染对话组件，被否决。

### 决策 2：讯飞调用走 WebSocket 而不是 HTTP POST
**选择**：在 `ws-gateway.ts` 注册 `tts.request` 消息处理器，命中后开新 WS 连讯飞，按帧把音频回推给前端 `tts.audio`。
**为什么**：
- 讯飞 TTS 协议本身就是 WS 流式的，HTTP 包一层会丢失流式优势（首帧延迟从 ~200ms 上升到 ~1s）。
- 前端用 Web Audio API 拼帧播放，可以做到"边收边播"。
- 复用现有 ws-gateway 路由器，前端只需新增一条 WS 连接。
**替代方案**：后端 HTTP `/api/tts` 一次性返回 MP3 —— 实现简单但延迟差，被否决。

### 决策 3：前端建独立的 TTS WebSocket，不与对话流程混用
**选择**：`iflytek-tts-client.ts` 内部维护一条 WS（`ws://localhost:3001`），仅用于发 `tts.request` / 收 `tts.audio`。对话仍走 HTTP。
**为什么**：
- 当前 `Conversation.tsx` 没连 WS，强行切对话主链路风险大。
- TTS WS 是无状态的（每次 `tts.request` 独立），不需要 session.start，简化逻辑。
**替代方案**：把对话也切到 ws-gateway 那套 —— 工作量大且超出本变更目标。

### 决策 4：音频帧前端 Web Audio API 拼装
**选择**：讯飞返回 base64 PCM 16kHz/16bit/mono → 前端解码为 Int16Array → 转 Float32 → `AudioBufferSourceNode` 排队播放。
**为什么**：浏览器原生支持，零依赖；PCM 比 MP3 解码更简单，且讯飞 PCM 流式更稳定。
**替代方案**：让讯飞返回 MP3 → 前端 `<audio>` 播 —— 实现更易但流式拼接 MP3 要处理 frame header，反而复杂。

### 决策 5：设置存储用 zustand + localStorage
**选择**：新建 `web/src/store/settings.ts`，schema：`{ ttsEngine: 'browser' | 'iflytek', iflytekVoice: string }`，订阅 localStorage 持久化。
**为什么**：项目已用 zustand（`store/session.ts`），保持一致。
**替代方案**：直接 `localStorage.getItem` 散落各处 —— 已有 store 模式不该破坏。

### 决策 6：齿轮按钮放对话页 Header，弹层而非新页面
**选择**：`SettingsPanel.tsx` 是 Modal/Drawer 组件，触发器是 Header 右侧 ⚙️ 图标，与"End Session"并列。
**为什么**：
- 用户希望不离开当前对话就能切换音色。
- 跳新页面会丢对话上下文，体验差。

### 决策 7：失败降级链
**选择**：讯飞引擎在以下情况自动 fallback 到浏览器引擎并 toast 提示：
1. 后端返回 `tts.error`（key 缺失、讯飞鉴权失败、网络不通）
2. WS 连接 5s 内未建立
3. 音频帧 3s 内未收到首帧
**为什么**：陪练场景下"无声"比"音色不完美"更糟糕。

## Risks / Trade-offs

- **[Risk] 讯飞 AppId 配额**：免费版每天 5 万字符。→ Mitigation：在后端记录用量、超限时降级到浏览器引擎；后续接入企业账号。
- **[Risk] 内网不通讯飞域名**：携程内网代理可能拦截。→ Mitigation：`.env.example` 标注需开通外网；首次连接失败立即 fallback。
- **[Risk] 引擎切换时正在播放的音频处理**：用户切到讯飞时浏览器还在念。→ Mitigation：切换时先 `currentEngine.stop()` 再切，新句子才用新引擎。
- **[Risk] 前端 WS 重连**：移动端/网络抖动会断 WS。→ Mitigation：`iflytek-tts-client` 实现指数退避重连；重连期间退化到浏览器引擎。
- **[Risk] PCM 流式拼接的 click/pop 噪声**：相邻帧未对齐易爆音。→ Mitigation：用 `AudioContext.currentTime` 队列调度，每帧 `start(prevEnd)` 串行，避免重叠/空隙。
- **[Trade-off] 双 WS 连接**：前端会同时持有"对话不用 WS"+"TTS 单独 WS"，看起来不对称。→ 接受。本变更不重构对话链路，未来若整体迁移再统一。
- **[Trade-off] localStorage 不跨设备**：用户换浏览器会丢配置。→ 接受。本工程是本地工具，不做账号系统。

## Migration Plan

阶段 1：基础设施（不改 UI）
1. `shared/contracts.ts` 加 4 个 TTS 消息类型 → 编译通过即可，无前后端调用方
2. `server/src/lib/iflytek-auth.ts` 实现签名 + 单元测试
3. `server/src/modules/tts.service.ts` 加 `IflytekTtsService` 类（不替换现有 `OpenAITtsService`）
4. `ws-gateway.ts` 注册 `tts.request` 处理器（前端没人调，先空跑）

阶段 2：前端引擎抽象（用户无感知）
5. `web/src/audio/tts-engine.ts` 抽接口 + 注册表
6. `web/src/audio/iflytek-tts-client.ts` 实现讯飞引擎（连 WS、Web Audio 播放）
7. `web/src/store/settings.ts` 加配置 store
8. `Conversation.tsx` 把 `synthesisRef` 替换为引擎工厂调用 —— 此时默认仍是 `browser`，用户行为不变

阶段 3：UI 暴露
9. `SettingsPanel.tsx` 实现齿轮 + Modal
10. 在 Header 接入按钮
11. 文档：`.env.example` 加讯飞 key 注释 + `README` 加配置说明

**回滚**：阶段 3 完成前，所有改动对用户透明（默认 `browser`）。出事改 `settings.ts` 默认值即可，不需 revert 代码。

## Open Questions

1. **讯飞 AppId 由谁申请、放哪里？** —— 用户私人账号 / 团队账号？建议用户先申请，把三件套写进根 `.env`（不进 git），`.env.example` 留空模板。
2. **音色清单写死还是从讯飞接口拉取？** —— 讯飞官方未提供可枚举音色 API；建议在 `web/src/audio/iflytek-voices.ts` 维护静态列表（4-6 个常用英文音色），文档化。
3. **是否需要在报告页也用讯飞 TTS（朗读纠错示例）？** —— 本变更先不做，等基础设施稳定再扩展。
4. **超拟人音色 / 情绪标签是否要支持？** —— Non-Goal，下个变更再议。
